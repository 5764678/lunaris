"""Minimal PDS3 ODL label parser.

Covers the subset of the Object Description Language used by LOLA GDR and similar
labels: ``KEY = value`` statements, nested ``OBJECT``/``END_OBJECT`` blocks, quoted
strings spanning lines, ``{...}``/``(...)`` sequences spanning lines, ``/* */``
comments, pointers (``^IMAGE``) and units (``240 <m/pix>``).

Value mapping:

* ``"text"`` → ``str`` (internal whitespace runs collapsed to one space);
* ``'N/A'`` and bare symbols (``LSB_INTEGER``) → ``str``;
* integers → ``int``; reals (``1737400.``, ``0.5``) → ``float``;
* a number with a unit → :class:`Pds3Quantity`;
* sequences/sets → ``tuple`` of the above.

Reference: PDS3 Standards Reference, chapter 12 (Object Description Language).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


class Pds3LabelError(ValueError):
    """Raised when a label cannot be parsed or lacks a required keyword."""


@dataclass(frozen=True, slots=True)
class Pds3Quantity:
    """A numeric value with its unit as written in the label (for example ``m/pix``)."""

    value: float
    unit: str


Pds3Value = str | int | float | Pds3Quantity | tuple["Pds3Value", ...]


@dataclass(slots=True)
class Pds3Object:
    """An ODL object: its keywords and nested objects, in label order."""

    name: str
    keywords: dict[str, Pds3Value] = field(default_factory=dict)
    objects: list[Pds3Object] = field(default_factory=list)

    def get(self, key: str) -> Pds3Value:
        """Return a keyword value; raises :class:`Pds3LabelError` if absent."""
        try:
            return self.keywords[key]
        except KeyError:
            raise Pds3LabelError(f"keyword {key!r} missing from {self.name}") from None

    def object(self, name: str) -> Pds3Object:
        """Return the first nested object named ``name`` (searched depth-first)."""
        for child in self.objects:
            if child.name == name:
                return child
            try:
                return child.object(name)
            except Pds3LabelError:
                continue
        raise Pds3LabelError(f"object {name!r} not found in {self.name}")

    def number(self, key: str) -> float:
        """Return a numeric keyword as ``float`` (unit, if any, is dropped)."""
        value = self.get(key)
        if isinstance(value, Pds3Quantity):
            return value.value
        if isinstance(value, int | float):
            return float(value)
        raise Pds3LabelError(f"keyword {key!r} in {self.name} is not numeric: {value!r}")

    def text(self, key: str) -> str:
        value = self.get(key)
        if not isinstance(value, str):
            raise Pds3LabelError(f"keyword {key!r} in {self.name} is not text: {value!r}")
        return value

    def quantity(self, key: str) -> Pds3Quantity:
        value = self.get(key)
        if not isinstance(value, Pds3Quantity):
            raise Pds3LabelError(f"keyword {key!r} in {self.name} has no unit: {value!r}")
        return value


_TOKEN = re.compile(
    r"""
    (?P<comment>/\*.*?\*/)
  | (?P<dquote>"[^"]*")
  | (?P<squote>'[^']*')
  | (?P<unit><[^>]*>)
  | (?P<punct>[={}(),])
  | (?P<word>[^\s={}(),"'<>]+)
  | (?P<space>\s+)
    """,
    re.VERBOSE | re.DOTALL,
)
_INT = re.compile(r"^[+-]?\d+$")
_REAL = re.compile(r"^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$")


def _tokens(text: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    position = 0
    while position < len(text):
        match = _TOKEN.match(text, position)
        if match is None:
            raise Pds3LabelError(f"unexpected character at offset {position}: {text[position]!r}")
        kind = match.lastgroup
        assert kind is not None  # noqa: S101 - every alternative is a named group
        if kind not in ("space", "comment"):
            out.append((kind, match.group()))
        position = match.end()
    return out


def _scalar(word: str) -> str | int | float:
    if _INT.match(word):
        return int(word)
    if _REAL.match(word):
        return float(word)
    return word


class _Parser:
    def __init__(self, tokens: list[tuple[str, str]]) -> None:
        self.tokens = tokens
        self.index = 0

    def peek(self) -> tuple[str, str] | None:
        return self.tokens[self.index] if self.index < len(self.tokens) else None

    def take(self) -> tuple[str, str]:
        token = self.peek()
        if token is None:
            raise Pds3LabelError("unexpected end of label")
        self.index += 1
        return token

    def value(self) -> Pds3Value:
        kind, text = self.take()
        if kind == "punct" and text in "{(":
            closing = "}" if text == "{" else ")"
            items: list[Pds3Value] = []
            while True:
                nxt = self.peek()
                if nxt is None:
                    raise Pds3LabelError("unterminated sequence")
                if nxt == ("punct", closing):
                    self.take()
                    return tuple(items)
                if nxt == ("punct", ","):
                    self.take()
                    continue
                items.append(self.value())
        if kind == "dquote":
            return " ".join(text[1:-1].split())
        if kind == "squote":
            return text[1:-1]
        if kind == "word":
            scalar = _scalar(text)
            nxt = self.peek()
            if nxt is not None and nxt[0] == "unit" and not isinstance(scalar, str):
                self.take()
                return Pds3Quantity(float(scalar), nxt[1][1:-1].strip())
            return scalar
        raise Pds3LabelError(f"unexpected token {text!r}")

    def block(self, name: str, terminator: str) -> Pds3Object:
        obj = Pds3Object(name)
        while True:
            token = self.peek()
            if token is None:
                if terminator == "END":
                    return obj
                raise Pds3LabelError(f"object {name!r} is not closed")
            kind, word = self.take()
            if kind != "word":
                raise Pds3LabelError(f"expected a keyword, got {word!r}")
            if word == terminator:
                if terminator == "END_OBJECT" and self.peek() == ("punct", "="):
                    self.take()
                    self.take()
                return obj
            if self.take() != ("punct", "="):
                raise Pds3LabelError(f"expected '=' after {word!r}")
            if word == "OBJECT":
                child_name = self.value()
                obj.objects.append(self.block(str(child_name), "END_OBJECT"))
            else:
                obj.keywords[word] = self.value()


def parse_pds3_label(text: str) -> Pds3Object:
    """Parse ODL label text into a root :class:`Pds3Object` named ``"ROOT"``."""
    return _Parser(_tokens(text)).block("ROOT", "END")


def read_pds3_label(path: Path) -> Pds3Object:
    """Read and parse a PDS3 label file (ASCII)."""
    return parse_pds3_label(path.read_text(encoding="ascii", errors="strict"))


def resolve_pointer(label_path: Path, file_name: str) -> Path:
    """Resolve a label pointer to a file next to the label, case-insensitively.

    PDS3 file names are upper case in labels; archives and local copies may use lower
    case. An exact match wins; otherwise a unique case-insensitive match is used.
    """
    directory = label_path.parent
    exact = directory / file_name
    if exact.is_file():
        return exact
    matches = [p for p in directory.iterdir() if p.name.lower() == file_name.lower()]
    if len(matches) == 1 and matches[0].is_file():
        return matches[0]
    if not matches:
        raise Pds3LabelError(f"pointer target {file_name!r} not found next to {label_path}")
    raise Pds3LabelError(f"pointer target {file_name!r} is ambiguous in {directory}")


__all__ = [
    "Pds3LabelError",
    "Pds3Object",
    "Pds3Quantity",
    "Pds3Value",
    "parse_pds3_label",
    "read_pds3_label",
    "resolve_pointer",
]
