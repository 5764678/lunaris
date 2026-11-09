/**
 * Lunar surface shader.
 *
 * Two surface modes, always disclosed in the viewport HUD:
 *
 *  - MODE_TEXTURE (1): a real NASA color map (SVS CGI Moon Kit, acquired and built by
 *    `lunaris-data`), sampled per fragment from body-fixed MOON_ME longitude/latitude
 *    (equirectangular, −180…180° centred on 0°). No relief is added: real topography
 *    arrives with LOLA ingestion (Milestone 02).
 *  - MODE_PROCEDURAL (0): a PLACEHOLDER surface generated from noise and a synthetic
 *    crater field. It is NOT lunar data and does not depict real features. Evaluated in
 *    3D on the sphere, so there is no seam or polar pinching.
 *
 * Shading: Lunar-Lambert reflectance (McEwen 1991 form) with a view-relative display
 * light. The light is NOT the computed Sun direction.
 *
 * Noise: gradient noise with analytic derivatives after Inigo Quilez; hash after
 * Dave Hoskins ("Hash without Sine", MIT).
 */

export const MODE_PROCEDURAL = 0;
export const MODE_TEXTURE = 1;

export const moonVertexShader = /* glsl */ `
  varying vec3 vObjPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vObjPos = normalize(position);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const moonFragmentShader = /* glsl */ `
  uniform vec3 uLightDir;
  uniform float uNightFloor;
  uniform int uMode;
  uniform sampler2D uColorMap;
  uniform float uExposure;

  varying vec3 vObjPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  const float PI = 3.141592653589793;

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
  }

  vec3 gradientAt(vec3 cell) {
    return hash33(cell) * 2.0 - 1.0;
  }

  // Gradient noise: value in .x, analytic derivatives in .yzw.
  vec4 noised(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec3 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

    vec3 ga = gradientAt(i + vec3(0.0, 0.0, 0.0));
    vec3 gb = gradientAt(i + vec3(1.0, 0.0, 0.0));
    vec3 gc = gradientAt(i + vec3(0.0, 1.0, 0.0));
    vec3 gd = gradientAt(i + vec3(1.0, 1.0, 0.0));
    vec3 ge = gradientAt(i + vec3(0.0, 0.0, 1.0));
    vec3 gf = gradientAt(i + vec3(1.0, 0.0, 1.0));
    vec3 gg = gradientAt(i + vec3(0.0, 1.0, 1.0));
    vec3 gh = gradientAt(i + vec3(1.0, 1.0, 1.0));

    float va = dot(ga, f - vec3(0.0, 0.0, 0.0));
    float vb = dot(gb, f - vec3(1.0, 0.0, 0.0));
    float vc = dot(gc, f - vec3(0.0, 1.0, 0.0));
    float vd = dot(gd, f - vec3(1.0, 1.0, 0.0));
    float ve = dot(ge, f - vec3(0.0, 0.0, 1.0));
    float vf = dot(gf, f - vec3(1.0, 0.0, 1.0));
    float vg = dot(gg, f - vec3(0.0, 1.0, 1.0));
    float vh = dot(gh, f - vec3(1.0, 1.0, 1.0));

    float value = va + u.x * (vb - va) + u.y * (vc - va) + u.z * (ve - va)
      + u.x * u.y * (va - vb - vc + vd) + u.y * u.z * (va - vc - ve + vg)
      + u.z * u.x * (va - vb - ve + vf) + (-va + vb + vc - vd + ve - vf - vg + vh) * u.x * u.y * u.z;

    vec3 derivative = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.z * (ge - ga)
      + u.x * u.y * (ga - gb - gc + gd) + u.y * u.z * (ga - gc - ge + gg)
      + u.z * u.x * (ga - gb - ge + gf) + (-ga + gb + gc - gd + ge - gf - gg + gh) * u.x * u.y * u.z
      + du * (vec3(vb, vc, ve) - va
        + u.yzx * vec3(va - vb - vc + vd, va - vc - ve + vg, va - vb - ve + vf)
        + u.zxy * vec3(va - vb - ve + vf, va - vb - vc + vd, va - vc - ve + vg)
        + u.yzx * u.zxy * (-va + vb + vc - vd + ve - vf - vg + vh));

    return vec4(value, derivative);
  }

  // Synthetic crater field at one frequency: height in .x, gradient (w.r.t. p) in .yzw.
  // Crater centres sit in the middle half of their cell and their influence ends within
  // 0.46 cell, so the 2×2×2 block around p contains every crater that can touch it.
  // Slope magnitude is frequency independent (crater depth scales with radius), giving a
  // roughly D^-2 cumulative size distribution across octaves.
  vec4 craterField(vec3 p, float freq, float seed, float density, float depthScale) {
    vec3 x = p * freq;
    vec3 base = floor(x - 0.5);
    float height = 0.0;
    vec3 gradient = vec3(0.0);
    for (int k = 0; k <= 1; k++) {
      for (int j = 0; j <= 1; j++) {
        for (int l = 0; l <= 1; l++) {
          vec3 cell = base + vec3(float(l), float(j), float(k));
          vec3 r1 = hash33(cell + seed);
          vec3 r2 = hash33(cell + seed + 17.31);
          if (r2.x > density) continue;
          vec3 d = x - (cell + 0.25 + 0.5 * r1);
          float dist = length(d);
          float radius = mix(0.07, 0.235, r2.y * r2.y);
          float t = dist / radius;
          if (t > 1.95) continue;
          // Degradation: older craters are shallower with broader, lower rims.
          float fresh = mix(0.25, 1.0, r2.z * r2.z);
          float rimWidth = mix(0.36, 0.2, fresh);
          float u = t - 1.0;
          float rim = 0.3 * fresh * exp(-(u * u) / (rimWidth * rimWidth));
          float dRim = rim * (-2.0 * u / (rimWidth * rimWidth));
          float floorLevel = -mix(0.35, 0.8, fresh);
          float bowl = 0.0;
          float dBowl = 0.0;
          if (t < 1.0) {
            float b = (t * t - 1.0) * fresh;
            bowl = max(b, floorLevel);
            dBowl = b > floorLevel ? 2.0 * t * fresh : 0.0;
          }
          height += depthScale * (radius / freq) * (bowl + rim);
          gradient += depthScale * (dBowl + dRim) * d / max(dist, 1e-5);
        }
      }
    }
    return vec4(height, gradient);
  }

  float lunarLambert(vec3 n, vec3 l, vec3 v) {
    float mu0 = max(dot(n, l), 0.0);
    float mu = max(dot(n, v), 1e-4);
    const float L = 0.62;
    return 2.0 * L * mu0 / (mu0 + mu) + (1.0 - L) * mu0;
  }

  vec2 equirectUv(vec3 objPos) {
    // Scene → MOON_ME: (x, y, z)_scene = (x_me, z_me, -y_me)
    vec3 me = vec3(objPos.x, -objPos.z, objPos.y);
    float lon = atan(me.y, me.x);
    float lat = asin(clamp(me.z, -1.0, 1.0));
    return vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
  }

  void main() {
    vec3 p = normalize(vObjPos);
    vec3 nGeom = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    vec3 l = normalize(uLightDir);

    vec3 albedo;
    vec3 n = nGeom;

    if (uMode == ${MODE_TEXTURE}) {
      vec2 uv = equirectUv(p);
      // Seam-safe derivatives: pick the smaller of the wrapped/unwrapped gradients.
      vec2 uvAlt = vec2(fract(uv.x + 0.5) - 0.5, uv.y);
      vec2 dx = dFdx(uv), dy = dFdy(uv);
      vec2 dxAlt = dFdx(uvAlt), dyAlt = dFdy(uvAlt);
      if (dot(dxAlt, dxAlt) < dot(dx, dx)) dx = dxAlt;
      if (dot(dyAlt, dyAlt) < dot(dy, dy)) dy = dyAlt;
      albedo = textureGrad(uColorMap, uv, dx, dy).rgb;
    } else {
      // PLACEHOLDER surface — synthetic, not lunar data.
      float pixel = max(length(fwidth(p)), 1e-6);
      vec3 gradient = vec3(0.0);
      float freshRim = 0.0;

      // Broad, shallow basins carry the darker "mare-like" tone of the placeholder.
      vec4 basins = craterField(p, 1.15, 91.7, 0.5, 0.35);
      gradient += basins.yzw;
      float basinFloor = smoothstep(0.0, -0.025, basins.x);

      float freq = 3.0;
      for (int octave = 0; octave < 8; octave++) {
        float cellPixels = (1.0 / freq) / pixel;
        float weight = smoothstep(3.0, 10.0, cellPixels);
        if (weight <= 0.0) break;
        vec4 c = craterField(p, freq, float(octave) * 7.13, 0.9, mix(0.7, 1.0, float(octave) / 7.0));
        gradient += weight * c.yzw;
        freshRim += weight * max(c.x, 0.0) * freq;
        freq *= 2.04;
      }

      vec4 fine = noised(p * 96.0);
      float fineWeight = smoothstep(2.0, 8.0, (1.0 / 96.0) / pixel);
      vec4 rolling = noised(p * 14.0 + 5.3);
      gradient += fineWeight * 0.05 * fine.yzw + 0.025 * rolling.yzw;

      vec4 broad = noised(p * 1.6 + 3.1);
      vec4 mid = noised(p * 5.7 - 1.7);
      float tone = 0.27 + 0.06 * broad.x + 0.035 * mid.x + 0.02 * fine.x * fineWeight;
      tone *= mix(1.0, 0.62, basinFloor * smoothstep(-0.1, 0.25, noised(p * 2.3 + 8.0).x + 0.15));
      tone += 0.06 * clamp(freshRim * 4.0, 0.0, 1.0);
      albedo = vec3(tone) * vec3(1.0, 0.98, 0.95);

      vec3 tangentialGradient = gradient - nGeom * dot(gradient, nGeom);
      n = normalize(nGeom - 0.36 * tangentialGradient);
    }

    float terminator = smoothstep(-0.03, 0.08, dot(nGeom, l));
    float radiance = lunarLambert(n, l, v) * terminator;
    vec3 color = albedo * (radiance * uExposure + uNightFloor);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
