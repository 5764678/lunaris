# Turn LUNARIS into Thailand's Moon-mission classroom

LUNARIS should enter the 2027 award as a teaching innovation, not as a mission-planning tool. The proposed entry is **"LUNARIS ห้องเรียนภารกิจดวงจันทร์" (LUNARIS Moon-Mission Classroom)**, a six-period IPST-style 5E inquiry kit for **ม.3 (Grade 9)**. Students first build a lamp-and-ball model. Then a Thai-language, lightweight classroom mode of the existing SPICE/LOLA platform lets them connect the Moon as seen from Earth with the sky as seen from the lunar south pole. Finally they defend a landing-site choice using LUNARIS's labelled evidence.

ม.3 is the only secondary grade where Moon phases, the Sun's apparent motion and space technology are compulsory end-point indicators for every student (ว 3.1 ม.3/2–ม.3/4). The same grade carries matching technology (ว 4.1, ว 4.2) and mathematics (ค 2.2 ม.3/2, ค 3.1 ม.3/1) indicators, so about eleven indicators fit in one unit. A ม.6 track built on IPST's additional course chapter on the celestial sphere is the natural extension.

The problem can be measured. Earth and space science is tied for the weakest strand of the ม.3 O-NET science test at **31.92%**. Thai science scores sit **50 points below the OECD average in PISA 2025**. The "Earth's shadow causes the phases" misconception persists among Thai students, pre-service teachers and in-service teachers alike.

Meta-analyses favour this design. Simulations embedded in the curriculum have an effect of **g = 0.81**, and running them over 4–6 sessions gives **g = 0.91**, provided the inquiry is guided. Unguided and VR-heavy approaches do much worse.

The timing is unusually good. Thailand's first lunar payload rides on Chang'e-7 to Shackleton crater. NARIT says that launch slipped to 2027 because the lighting requirements at the landing site could not be met in 2026, which is exactly the kind of illumination question LUNARIS computes.

To be ready for the judges in the 16 days before 27 Nov, the team should build only four things:
- a Thai lesson route;
- a "view from Earth" camera;
- static precomputed lesson data, so a sleeping Render server can never stall a class;
- a printable Thai teaching kit.

The nine weeks before the 14 Jan final should go to a classroom pilot with IOC-validated instruments and E1/E2 testing. There are three main risks:
- **Overclaiming.** The software alone does not cover tides or the "construct a model" verb.
- **Reliability.** The kit must work on phones and projectors.
- **Pilot calendar.** Most schools have already taught their ม.3 Moon unit for this year.

## Reframe LUNARIS from mission planner to mission-based learning kit

The judging criteria reward creativity and problem-solving design, appropriate technology, practical and commercial potential, and presentation. Every one of them is easier to win with a **learning-activity package that contains a platform** than with a platform alone. The competition accepts innovations that are "created or adapted to the user's context and usable in practice." Adapting LUNARIS from mission planning to Thai classrooms is therefore a legitimate innovation in itself, and the entry form should say so plainly.

Inside Thai education practice, the deliverable that a Faculty of Education panel recognises is a ชุดกิจกรรมการเรียนรู้ (learning-activity set). It should come with:
- แผนการจัดการเรียนรู้ (lesson plans);
- ใบงาน (worksheets);
- an evaluation that uses the national R&D conventions (IOC, E1/E2).

The software is the medium inside that set, not the whole entry.

### Three layers

The product should have three layers.

1. **The teaching kit.** This is the innovation the judges score: six 50-minute periods, Thai worksheets and a validated test.
2. **A new "Classroom" mode of the web app.** It is Thai-first, guided step by step, light enough for a phone or a projector, and it runs from precomputed data.
3. **The existing LUNARIS Explorer.** The current Overview, Illumination & Earth, Terrain, Compare and Data Sources pages stay as the open-ended instrument. They serve ม.6 enrichment, teacher professional development and the poster's credibility.

### The core idea: two viewpoints, one decision

Students reconcile two pictures of the same geometry:
- **the Earth-based view:** phases and moonrise as seen from Bangkok;
- **the space-based and lunar-surface view:** the terminator on a Moon lit by the true Sun, the Sun skimming the horizon at the south pole, and Earth hanging in the lunar sky.

Then they use that understanding to make an engineering decision with visible trade-offs. Astronomy education research identifies this coordination of frames of reference as the core difficulty in learning lunar phases ([Plummer 2014](https://indico.unina.it/event/73/contributions/1042/attachments/359/649/2014_-_Review_Spatial_Thinking.pdf)). It is also the feature no competing tool offers.

### Name and title

The recommended name is **LUNARIS ห้องเรียนภารกิจดวงจันทร์ (LUNARIS Moon-Mission Classroom)**, with the tagline **"มองจากโลก ยืนบนดวงจันทร์ ตัดสินใจด้วยหลักฐาน"** ("look from Earth, stand on the Moon, decide with evidence").

For the entry form, the conventional long Thai title would be: "ชุดกิจกรรมการเรียนรู้แบบสืบเสาะหาความรู้ (5E) ร่วมกับแพลตฟอร์มจำลองภารกิจดวงจันทร์ LUNARIS เพื่อพัฒนาแบบจำลองทางความคิดเรื่องระบบโลก–ดวงจันทร์–ดวงอาทิตย์และการตัดสินใจจากข้อมูลจริง สำหรับนักเรียนชั้นมัธยมศึกษาปีที่ 3". A native-speaking Thai science educator should polish both names before submission.

### Category and eligibility

The poster lists two kinds of entrant:
- **Teacher:** early childhood and primary, secondary, or vocational.
- **Student:** primary, secondary or vocational, with an advisor teacher.

The entrant type therefore depends on who the team is. If a practising secondary teacher is on the team, the stronger route is the teacher–secondary category with that teacher as lead innovator, because that teacher can run the pilot and own the lesson plans. If the team members are secondary students, they enter student–secondary with an advisor teacher who also runs the pilot. If the developers are neither, they need a partner teacher as the named entrant. Confirm the co-inventor rules with the organisers.

The 2569 predecessor was a teacher-only "รางวัลครูนวัตกรแห่งจุฬาลงกรณ์มหาวิทยาลัย" open to teachers at every level ([Faculty of Education call](https://www.edu.chula.ac.th/node/3527)). The 2570 student categories appear to be new, so there are no student precedents to benchmark against.

### Heritage and positioning

The platform's science pedigree, per the LUNARIS repository, should appear on the poster as a single credibility line, not as the headline:
- agreement with JPL Horizons to 0.002″;
- agreement with the published Mazarico et al. (2011) illumination maps to within 0.042;
- 757 automated tests across the Python core, the web unit suite and the browser end-to-end suite.

The NASA Space Apps heritage is an asset to cite. The colleague's separate Space Apps 2026 repository should stay clearly distinct, so that authorship of the competition entry is unambiguous.

Position LUNARIS as **complementary** to IPST, NARIT and DLTV materials. Students learn the Earth view with their textbook and a physical model, then switch to the Moon's point of view in LUNARIS. This avoids presenting the kit as a replacement for the national textbook.

## Grade 9 is the only secondary grade where the Moon is compulsory

The recommendation is to **target ม.3 as the primary grade and offer ม.6 as an advanced track**, leaving ม.1, ม.2, ม.4 and ม.5 out of the core claim. Under the 2551 core curriculum (2560 revision), which still governs secondary schools, ม.1 and ม.2 carry no ว 3.1 astronomy indicators. Their strand-3 indicators cover the atmosphere, weather and energy ([OBEC science indicators](https://docs.google.com/document/d/1WHgfLEJniuNNSfvbX9VaEOmDaOlwqlOG/export?format=pdf)).

At ม.3, three of the four ว 3.1 indicators are **terminal (ปลายทาง)** indicators that every student must meet. Their wording has been confirmed word for word against an independent DLTV unit plan, which teaches them as a 60-hour unit in ภาคเรียนที่ 1 ([DLTV ม.3 unit plan ว23101](https://dltv.ac.th/utils/files/download/185601)). The same grade carries the computing, design and mathematics indicators that a data-driven site-selection task naturally serves ([OBEC math indicators](https://docs.google.com/document/d/1md7-JRZlSwKme8-BrMW6jSaCRVN6tBA3/export?format=pdf)).

### Eleven ม.3 indicators, with three honest caveats

| Indicator | Official wording (verbatim, abridged where marked …) | What students do in LUNARIS Classroom | Strength of claim |
|---|---|---|---|
| **ว 3.1 ม.3/2** (terminal) | สร้างแบบจำลองที่อธิบายการเกิดฤดู และการเคลื่อนที่ปรากฏของดวงอาทิตย์ | Compare the Sun's apparent path over a lunar south-pole skyline (low and grazing) with Bangkok's; reason about incidence angle and sunlit fraction | Strong for apparent solar motion; seasons still need the Earth-side textbook activity |
| **ว 3.1 ม.3/3** (terminal) | สร้างแบบจำลองที่อธิบายการเกิดข้างขึ้นข้างแรม การเปลี่ยนแปลงเวลาการขึ้นและตกของดวงจันทร์ และการเกิดน้ำขึ้นน้ำลง | Build a lamp-and-ball model, then step through a lunation on the SPICE-lit globe with a new Earth-view camera (predict–observe–explain); track moonrise timing; spring/neap tides (น้ำเกิด/น้ำตาย) | Phases are strong once the Earth-view camera exists; moonrise needs a Bangkok sky lane; **tides are not covered by the software today** |
| **ว 3.1 ม.3/4** (terminal) | อธิบายการใช้ประโยชน์ของเทคโนโลยีอวกาศ และยกตัวอย่างความก้าวหน้าของโครงการสำรวจอวกาศ จากข้อมูลที่รวบรวมได้ | Use real LRO/LOLA terrain and SPICE geometry; connect results to Chang'e-7/CE-7 MATCH, CE-8 ALIGN and Artemis | Strong |
| **ว 4.1 ม.3/3** | ออกแบบวิธีการแก้ปัญหา โดยวิเคราะห์ เปรียบเทียบ และตัดสินใจเลือกข้อมูลที่จำเป็นภายใต้เงื่อนไขและทรัพยากรที่มีอยู่ … | Mission teams compare candidate sites with Pareto dominance and their own weights | Strong: this is the Compare page, almost literally |
| **ว 4.1 ม.3/4** | ทดสอบ ประเมินผล วิเคราะห์ และให้เหตุผลของปัญหาหรือข้อบกพร่องที่เกิดขึ้นภายใต้กรอบเงื่อนไข … | Re-test the choice when the mission profile or slope limit changes (sensitivity analysis) | Strong |
| **ว 4.1 ม.3/2** | ระบุปัญหาหรือความต้องการของชุมชนหรือท้องถิ่น … | Frame the task for a Thai stakeholder (a NARIT-style payload team) | Weak: the indicator is about community or local needs; claim only if framed that way |
| **ว 4.2 ม.3/2** (terminal) | รวบรวมข้อมูล ประมวลผล ประเมินผล นำเสนอข้อมูลและสารสนเทศตามวัตถุประสงค์ … | Collect sunlit fraction, slope and Earth-visibility metrics; present a recommendation | Strong |
| **ว 4.2 ม.3/3** | ประเมินความน่าเชื่อถือของข้อมูล วิเคราะห์สื่อและผลกระทบจากการให้ข่าวสารที่ผิด … | Use the evidence labels on every number (observation, model, calculation, assumption) to judge what to trust | Strong and distinctive |
| **ว 4.2 ม.3/1** (terminal) | พัฒนาแอปพลิเคชันที่มีการบูรณาการกับวิชาอื่นอย่างสร้างสรรค์ | Optional extension: write a site-scoring rule from exported data | Weak until CSV export exists |
| **ค 2.2 ม.3/2** | … อัตราส่วนตรีโกณมิติในการแก้ปัญหาทางคณิตศาสตร์และปัญหาในชีวิตจริง | Compute horizon elevation as arctan(h/d) on a crater rim and ask whether the Sun clears it (มุมเงย context) | Strong as an application |
| **ค 3.1 ม.3/1** | … นำเสนอและวิเคราะห์ข้อมูล จากแผนภาพกล่อง … โดยใช้เทคโนโลยีที่เหมาะสม | Draw box plots of slope or sunlit-window lengths across sites | Moderate; needs worksheet tables or export |

The three caveats should appear in the proposal itself, because education judges will check them.

1. **Both science indicators begin with the verb "สร้างแบบจำลอง" (construct a model).** Watching a simulation does not satisfy them. The unit therefore includes a physical lamp-and-ball model, prediction sketches and parameter-setting, so that students construct and test models rather than view them.
2. **LUNARIS has no tides model.** Tides are a third of ม.3/3. Until a qualitative spring/neap indicator is built, cover tides with an unplugged activity and claim ม.3/3 as "phases and moonrise; tides supported offline."
3. **Phases as seen from Earth are not shown today.** The camera presets are mission views (South polar, Pole, Near side, Far side). The globe shows the lit hemisphere, not the Moon's face as a Thai student sees it. The Earth-view camera is therefore the single most important build item for the curriculum claim.

### The ม.6 track

ม.6 is the honest second target, and its best alignment is technically the most precise one LUNARIS has. IPST's additional course "โลก ดาราศาสตร์ และอวกาศ" runs as six volumes. All the astronomy content sits in ม.6 ([IPST Project 14](https://proj14.ipst.ac.th/m4-6-earth/)):
- **เล่ม 5 บทที่ 16, เทคโนโลยีอวกาศและการประยุกต์ใช้** ([IPST เล่ม 5](https://proj14.ipst.ac.th/m4-6-earth/m6-earth-book5/));
- **เล่ม 6 บทที่ 17, ทรงกลมฟ้า**, which teaches the horizon (altitude–azimuth) coordinate system, the rising and setting paths of the Sun and stars, and apparent solar time ([IPST เล่ม 6](https://proj14.ipst.ac.th/m4-6-earth/m6-earth-book6/)).

LUNARIS's sky chart is an altitude–azimuth horizon display. It maps almost one-to-one onto บทที่ 17 activities 17.1–17.3 and 17.6, as listed in a school's ว30266 course plan ([course plan ว30266](https://mrws.ac.th/2021/wp-content/uploads/2022/08/%E0%B9%82%E0%B8%84%E0%B8%A3%E0%B8%87%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%AA%E0%B8%AD%E0%B8%99-%E0%B8%A7%E0%B9%93%E0%B9%90%E0%B9%92%E0%B9%96%E0%B9%96-%E0%B8%A1.%E0%B9%96-%E0%B8%A0%E0%B8%B2%E0%B8%84-%E0%B9%92.pdf)). It adds a far-transfer twist: the observer stands on the Moon.

This content is hard. In a 2025 Thai study, pre-service science teachers averaged only **27%** on a celestial-sphere pre-test ([Srikongrug & Nuangnun 2025](https://so05.tci-thaijo.org/index.php/SPUCJ/article/download/277409/186024/1198072)).

The basic ม.6 indicators add:
- ว 3.1 ม.6/9 on solar wind and solar storms, which is exactly what CE-7 MATCH measures;
- ว 3.1 ม.6/10 on space exploration with spacecraft and data;
- ว 3.2 ม.6/7 on why received solar energy varies by region, for which the lunar pole is a dramatic analogue.

ม.6 is still the second choice for two reasons. The additional course reaches mainly science-programme students. The basic ม.6 course is short, about 20 hours in one school's example.

### Devices, the school calendar and the coming curriculum

Two practical facts complicate the choice, and the proposal should address both openly.

**Devices.** The government's leased tablets and Chromebooks under "Anywhere Anytime" go to **ม.4–6 first** ([Daily News, Oct 2025](https://www.dailynews.co.th/news/5224071/)). ม.3 students, the curricular target, mostly have only phones, shared lab PCs or the teacher's projector. That is why projector and phone modes are core requirements and not nice-to-haves.

**Timing.** The most likely IPST placement puts the ม.3 unit "ระบบสุริยะของเรา" in เล่ม 1, semester 1. This rests on secondary sources plus DLTV's plan ([athometh](https://www.athometh.com/general-science/science-grade-3/)). One textbook file labels it เล่ม 2 หน่วย 8 instead ([anyflip title](https://anyflip.com/fdung/yhls/basic)). If semester 1 is right, most ม.3 classes finished the topic around September. Any classroom pilot between now and 14 Jan would then be a **post-unit consolidation**, not first teaching.

This is a design opportunity rather than a problem. A pre-test that shows the Earth's-shadow model surviving *after* the textbook unit is itself compelling problem evidence. The alternatives are:
- a school that teaches the unit in semester 2;
- a ม.6 class now studying เล่ม 6 in its second semester, as the ว30266 plan schedules it.

Ask the partner school, ideally a Satit Chula secondary teacher, which applies to them.

**The coming curriculum.** The competency-based curriculum is not yet relevant to the indicator mapping, but it matters for the story. It covers early childhood and ป.1–6 in 2568–2569. Lower and upper secondary are planned for 2570, but their framework "อยู่ระหว่างจัดทำ" (is still being drafted), and no nationwide mandate has been decided ([Banmuang, 22 Oct 2569](https://www.banmuang.co.th/news/education/495227)). The proposal should therefore lead with exact 2551/2560 indicator codes. It should then show a competency rubric that anticipates the 2570 secondary pilot.

OBEC's 2020 framework names these competencies ([OBEC CBC presentation](https://neqmap.bangkok.unesco.org/wp-content/uploads/2020/09/PPT-Rattana_Basic-Education-Presentation-on-CBC.pdf)):
- Self Management;
- Communication;
- Teamwork and Collaboration;
- Higher-Order Thinking;
- Active Citizenship.

The rubric should map them to Pareto reasoning, team roles, the pitch and data honesty. The official Thai wording of the competencies was not verified and must be checked.

## The problem: a strand scoring one-third and a shadow myth that teachers share

The problem statement should rest on four layers of evidence: national results, the specific strand, misconceptions, and the teacher side.

### National results

In **PISA 2025, released 8 Sept 2026**, Thailand scored **432 in science against an OECD average of 482**. That was a 23-point rise, but Thailand remained below the OECD in every domain. **36.9%** of students were below Level 2 in science, reading and mathematics at the same time ([The Nation, 10 Sept 2026](https://www.nationthailand.com/news/policy/40070867)).

PISA 2022 gives the proficiency baseline. Only **47%** of Thai students reached Level 2 in science, against 76% across the OECD ([IPST PISA 2022 release](https://www.ipst.ac.th/news/54912/20231106-pisa2022.html)).

The proposal must not cite TIMSS 2023 for Thailand. **Thailand did not take part**: it is absent from the official grade-8 science table ([TIMSS 2023 Exhibit 2.2.1](https://timss2023.org/wp-content/uploads/2024/11/2-2-1_ach-g8s-dist.pdf)).

### The specific strand

The national exam points at LUNARIS's exact content. In the official NIETS analysis of **O-NET ม.3, academic year 2567**, the national science mean was 34.22 across about 487,000 students. **Strand 3, Earth and space science, averaged 31.92% (SD 17.69).** NIETS flags it, with physical science, as the lowest strand ([NIETS O-NET ม.3 2567 report](https://nitedcr1.go.th/wp-content/uploads/2025/11/pdf_1757668552.pdf)).

### Misconceptions

Thai research on misconceptions is small-sample but consistent, and it matches large international datasets.

In a Sisaket study of 28 lower-secondary students, **52.4%** held either a misconception or no understanding of seasons, eclipses, phases and tides before instruction ([Jindawong 2012](http://backoffice.thaiedresearch.org/uploads/paper/91c1d3dc3dcc3ead7da1e3972434a8d9.pdf)). The misconceptions recorded include:
- phases caused by "the Earth's shadow falling on the Moon";
- one student's answer that phases happen "because it is วันพระ";
- seasons caused by Earth–Sun distance;
- high tide at night "because the Moon rises at night."

After 18 periods of model- and data-based reasoning, complete understanding rose from **14.3% to 63.7%**. That is direct Thai evidence that the LUNARIS approach can work.

Among 26 Khon Kaen pre-service science teachers, only **2 (7.7%)** explained phases soundly. **69.2%** reasoned only from the Earth–Moon relationship and ignored the Sun ([Saenpuk & Ruangsuwan](https://indico.global/event/8304/papers/76194/files/1891-98.The_pre-service_teachers_understanding_about_moon_phase.pdf)).

Internationally, more than 90% of untaught pre-service teachers held non-scientific ideas about phases. The Earth's-shadow model was the most frequent alternative conception, consistent with **11 other studies involving more than 3,000 participants** ([Trundle, Atwood & Christopher 2002](https://indico.unina.it/event/73/contributions/1042/attachments/359/631/2002_-_Preservice_Elementary_Teachers_Conceptions_of_Moon_Phases.pdf)).

### The teacher side

The teacher side turns a student problem into a system problem. Jansri and Ketpichainarong surveyed **45 Thai secondary science teachers** who all teach astronomy and none of whom trained in it ([IJEM 2020](https://www.ijem.com/articles/IJEM_6_4_745.pdf)):
- only **9%** fully understood the cause of the seasons;
- only **7%** could draw the Sun's path over Bangkok across the solstices;
- **40%** believed the Sun always rises due east.

The teachers named three obstacles:
1. **Low content confidence**, which pushes them into lecture and textbook reading: "I just stood in front of the classroom and explained what are described in the textbook".
2. **An overloaded, abstract curriculum.**
3. **A lack of equipment and time**, plus city skies too cloudy for observation.

PISA 2025 adds two figures. Only **46.6%** of Thai students attend schools reporting no teacher shortage, and only **36.8%** attend schools reporting no shortage of learning materials ([The Nation](https://www.nationthailand.com/news/policy/40070867)).

### Inequality

Inequality sharpens the case for a free, equipment-free tool. In PISA 2022, **only university demonstration schools scored above the OECD average** in mathematics and science ([IPST](https://www.ipst.ac.th/news/54912/20231106-pisa2022.html)). About 15,000 Thai schools have fewer than 120 students and serve nearly a million children ([World Bank](https://blogs.worldbank.org/en/eastasiapacific/providing-better-education-children-thailand-s-small-schools)).

This has a strategic implication for the pilot. A result obtained only at a Satit school proves little to judges who know that demonstration schools are the national outlier. **At least one try-out group should come from an ordinary OBEC school.**

### Proposal-ready problem statement

> Thai lower-secondary students score lowest on the Earth-and-space strand of the national exam, and the Earth's-shadow explanation of the phases persists through to their teachers. Teachers lack the content confidence, equipment, clear night skies and class time to let students observe and model the Sun–Earth–Moon system. Students rarely use real space-mission data to reason or decide, even though Thailand is now flying instruments to the Moon.

The claim that real-sky observation is impractical during school hours is a **reasoned inference** from the teachers' complaints. No Thai study measures it directly, so present it as an inference.

Avoid three widely circulated but untraced figures:
- a 15% out-of-field rate for science teachers;
- a "three-year" rural–urban PISA 2022 gap;
- a claim that PISA 2025 sampling standards were not met.

## Guided, embedded, multi-session simulation is where the effect sizes are

### What the meta-analyses say

The headline evidence for judges comes from the SRI meta-analysis of K-12 STEM simulations: **59 studies, robust to publication-bias tests** ([D'Angelo et al. 2014, SRI](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)).
- Simulation versus no simulation raised achievement by **g = 0.62**, and by **g = 0.67 in science alone**.
- Adding modifications such as scaffolding to a simulation added a further **g = 0.49**.

Its moderators read almost like a design specification for LUNARIS Classroom:

| Moderator | Effect |
|---|---|
| Simulation embedded in the curriculum | **g = 0.81** |
| Stand-alone but related to the curriculum | g = 0.53 |
| Stand-alone and unrelated | g = 0.20 (not significant) |
| Four to six sessions | **g = 0.91** |
| A single session | g = 0.49 |
| Scaffolding modifications | g = 0.60 |

This is the quantitative argument for a six-period unit inside the IPST sequence, rather than a one-period demonstration.

Three further findings set the limits:
- **Physical and virtual investigation produce equivalent conceptual learning** (g = −0.14, not significant, N = 3,303; adolescents g = −0.04) ([Muilwijk & Lazonder 2023](https://www.frontiersin.org/articles/10.3389/feduc.2023.1163024/full)). This supports pairing LUNARIS with a lamp-and-ball model rather than replacing it.
- **Head-mounted VR adds only a small effect** (ES = 0.24) ([Wu, Yu & Gu 2020](https://zendy.io/title/10.1111/bjet.13023)), which argues against chasing VR.
- **Better visuals alone do not guarantee better learning** ([Rutten et al. 2012](https://learntechlib.org/p/50686)).

### Guidance and inquiry

Inquiry works when it is guided.
- Inquiry-based science teaching averages an effect of **0.50**. Activities that make students generate and justify explanations reach **0.75** ([Furtak et al. 2012](https://experts.colorado.edu/display/pubid_22629)).
- Across 72 studies, guided inquiry beat unguided inquiry on learning outcomes (**d = 0.50**). Teacher explanations were among the most effective forms of guidance (d = 0.61) ([Lazonder & Harmsen 2016](https://www.clearinghouse.edu.tum.de/wp-content/uploads/2018/12/CHU_KR-5_Lazonder-Harmsen_2016_Forschendes-Lernen.pdf)).

The proposal should name its guidance in that vocabulary:
- **process constraints:** limited controls at first;
- **prompts;**
- **status overviews;**
- **teacher explanations at the Explain phase.**

It should avoid the phrase "discovery learning."

### Astronomy-specific evidence

The astronomy-specific evidence is smaller but points the same way.
- A predict–observe–explain strategy that combined 3D computer modelling with sky observation produced significant conceptual change in 131 Grade-6 students ([Küçüközer et al. 2009](https://istardb.org/wp-content/uploads/tainacan-items/1018/18872/Kucukozer-et-al.-2009-The-Effect-of-3D-Computer-Modeling-and-Observation.pdf)).
- Harvard–Smithsonian's WorldWide Telescope Moon-phases lab found that **students with low prior knowledge struggled with the complex 3D view**. Spatial skill was the only significant predictor of post-test score ([ICLS 2014](https://wwtambassadors.org/resource/2014iclswwtmoonpdf)).
- A follow-up ThinkSpace pilot that explicitly trained perspective-taking reported **d = 2.07** for 83 Grade-6 students, about double the earlier version ([AAS 2016 slides](https://wwtambassadors.org/resource/2016-aas-kissimmee-slidespdf)).

The ThinkSpace figure is a conference pilot and not peer-reviewed. It should inspire the design, not set the expected effect. The lesson for LUNARIS is concrete: start with the physical model, add "you are here" signposting and camera presets, and make the Earth-view/Moon-view switch an explicit, prompted step.

### Authentic data

Authentic data motivates students but pays off modestly, and judges will respect honesty about that. The best randomised trial of real research data in high-school classrooms involved 934 students in 44 classrooms. It found a significant gain in **constructing scientific explanations (d = 0.22)** and in data self-efficacy (d = 0.11), but no gain in overall quantitative reasoning ([Schultheis et al. 2022, Data Nuggets](https://par.nsf.gov/servlets/purl/10355954)). Its materials used three levels of claim–evidence–reasoning (CER) scaffolds and graphing scaffolds.

Two further findings matter:
- In simulations, salience of the relevant information matters more than authenticity ([Chernikova et al. 2024](https://portal.fis.tum.de/en/publications/where-salience-goes-beyond-authenticity-a-meta-analysis-on-simula/)).
- Low-prior-knowledge learners benefit most from worked examples ([Chernikova et al. 2020](https://epub.ub.uni-muenchen.de/84298/1/0034654320933544.pdf)).

LUNARIS's evidence labels are therefore a pedagogical asset only if they work as signalling cues: highlight the decisive number and hide the rest. They must not become another layer of clutter.

The PISA 2025 science framework names two competencies that this task trains ([OECD PISA 2025 science framework](https://pisa-framework.oecd.org/science-2025/)):
- "interpret scientific data and evidence critically";
- "research, evaluate and use scientific information for decision making and action."

### Theory stack

The proposal can cite a compact theory stack. Items marked † are standard citations that were not re-verified in this research, so check the DOIs before submission.

| Theory | Design consequence in LUNARIS Classroom |
|---|---|
| Conceptual change / constructivism | Elicit the Earth's-shadow model first, then create cognitive conflict ("where is Earth's shadow at full Moon?") |
| Model-based inquiry ([Windschitl et al. 2008](https://doi.org/10.1002/sce.20259)†) | Students build, predict with and revise a Sun–Earth–Moon model, physical first, then SPICE-driven |
| Spatial thinking and frames of reference ([Plummer 2014](https://indico.unina.it/event/73/contributions/1042/attachments/359/649/2014_-_Review_Spatial_Thinking.pdf)) | Linked Earth-view camera, lunar sky chart and lamp-and-ball model |
| Multimedia learning / cognitive load ([Mayer 2021](https://doi.org/10.1017/9781316941355)†) | Signalling through evidence labels; segmenting into mission steps; Thai vocabulary pre-training; hide advanced layers |
| Guided inquiry ([Lazonder & Harmsen 2016](https://www.clearinghouse.edu.tum.de/wp-content/uploads/2018/12/CHU_KR-5_Lazonder-Harmsen_2016_Forschendes-Lernen.pdf)) | Process constraints, prompts and explanations in each 5E phase |
| TPACK ([Mishra & Koehler 2006](https://doi.org/10.1111/j.1467-9620.2006.00684.x)†) | Teacher guide, projector mode and a short professional-development module |
| PISA 2025 competencies and science identity ([OECD](https://pisa-framework.oecd.org/science-2025/)) | Outcome measures: explanation, data interpretation, decision, self-efficacy |

## A six-period 5E unit that generates its own evaluation evidence

### The unit plan

The unit uses six 50-minute periods. Six is the top of SRI's most effective 4–6 session range, and the unit fits easily inside DLTV's 60-hour ม.3 term unit. Every period produces scored evidence: worksheets feed E1 and the post-test feeds E2.

No IPST document was found that sets 5E as official policy. The coordinator's understanding is that IPST uses 5E, so the team should cite an IPST source for it before submission.

| Period | 5E phase | What students do | LUNARIS feature | Indicators | Evidence captured |
|---|---|---|---|---|---|
| 1 | **Engage** (ขั้นสร้างความสนใจ) | Mission hook: a short clip on CE-7 MATCH bound for Shackleton. Sketch and explain why the Moon changes shape. Build a lamp-and-ball model in groups | Projector only; none required | ว 3.1 ม.3/3, ม.3/4 | Pre-test; prediction sketches |
| 2 | **Explore I** (ขั้นสำรวจและค้นหา) | Step a full lunation on the globe from the new Earth-view camera; log phase, % illuminated and Sun–Moon angle; test the "Earth's shadow" hypothesis; compare with a printed Thai lunar calendar (ปฏิทินจันทรคติ) and discuss why it can differ by a day | Earth-view camera, timeline scrub, Thai phase labels | ว 3.1 ม.3/3 | ใบงาน 1 (E1) |
| 3 | **Explain** (ขั้นอธิบายและลงข้อสรุป) | Teacher-led explanation; CER write-up on why phases happen; moonrise about 50 minutes later each day; spring and neap tides linked to phase (unplugged until the indicator exists) | Bangkok moonrise lane (P1), spring/neap indicator (P1) | ว 3.1 ม.3/2, ม.3/3 | ใบงาน 2 (E1); CER paragraph |
| 4 | **Elaborate I** (ขั้นขยายความรู้) | "Stand" at a south-pole site: the Sun skims the horizon, a crater floor at 0% sunlit, Earth hanging low; use trigonometry to decide whether the Sun clears a crater rim | Illumination & Earth sky chart; Pole Terrain | ว 3.1 ม.3/2; ค 2.2 ม.3/2 | ใบงาน 3 (E1) |
| 5 | **Elaborate II** | Mission teams (geologist, power engineer, communications officer) compare three sites, apply weights and check which numbers are observations, models or assumptions | Compare page (Pareto, weights); evidence labels | ว 4.1 ม.3/3, ม.3/4; ว 4.2 ม.3/2, ม.3/3; ค 3.1 ม.3/1 | Decision memo draft (E1) |
| 6 | **Evaluate** (ขั้นประเมิน) | Team pitch: "our recommended site for a Thai lunar experiment"; post-test; reflection | Classroom summary screen | ว 3.1 ม.3/4 | Post-test (E2); CER rubric; SUS; attitude scale |

### Cognitive-load rules

The design applies five cognitive-load rules drawn from the evidence above:
- **progressive disclosure:** one site and one variable first, then slope, roughness and Earth visibility;
- **one worked example:** a fully analysed site before the open comparison;
- **evidence labels as signals:** highlight what decides, collapse the rest;
- **Thai vocabulary pre-training;**
- **three-level scaffolds:** CER and graphing scaffolds at three levels, as in Data Nuggets (graph provided, then axes provided, then blank).

### Assessment instruments

| Instrument | Measures | Build or adapt | Quality checks | When |
|---|---|---|---|---|
| Concept test, about 20 items, two-tier format | Sun–Earth–Moon model, phases, moonrise and tides; polar illumination and Earth visibility | About 10 items adapted from the middle-school Moon Phases Concept Inventory (post-test α = 0.786, [PRPER 2020](https://link.aps.org/doi/10.1103/PhysRevPhysEducRes.16.020107)) and the [LPCI](https://www.physport.org/assessments/LPCI), plus 8–10 custom items; translate and back-translate; check permission to use and translate | IOC ≥ 0.50 from 3–5 experts; try-out on a non-sample class for difficulty (0.20–0.80), discrimination (≥ 0.20) and KR-20 (≥ 0.70) | Pre and post |
| Mission worksheets (ใบงาน 1–3) and decision memo | In-process learning | New, with an analytic rubric | IOC; two raters with Cohen's κ on the memo | Periods 2–5 |
| CER rubric for the pitch | Explanation and argument from evidence | Adapt the Data Nuggets CER levels | Inter-rater κ | Period 6 |
| Attitude and identity scale | Self-efficacy, enjoyment, instrumental motivation | PISA 2025 science-identity dimensions | Cronbach α | Pre and post |
| System Usability Scale, Thai translation | Usability | Translate the 10-item SUS ([reference](https://hriscaledatabase.psychology.gmu.edu/usability/2025/01/13/SUS.html)); no Thai validation exists, but a Malay version reached α = .85 ([JMIR 2018](https://humanfactors.jmir.org/2018/2/e10308/PDF)) | Target ≥ 68 (benchmark to be verified) | Post |
| Teacher interview | Implementation, TPACK, workload | Short semi-structured protocol | Not applicable | After the field try-out |

### The pilot: Thai R&D conventions plus international effect sizes

The pilot should follow the Thai "R&D of an educational innovation" sequence that judges expect, and add the international statistics that make it credible beyond Thailand.

**Expert validation.** **IOC** comes from Rovinelli and Hambleton. Experts rate each item +1, 0 or −1, and Thai practice uses the mean ([Tuntavanitch & Jindasri 2018](https://so02.tci-thaijo.org/index.php/jemmsu/article/view/174521)). The **≥ 0.50 cut-off** is a Thai applied-research convention, not a rule from the original paper ([example](https://so04.tci-thaijo.org/index.php/LEARN/article/download/102697/82244/259818)).

**Efficiency testing (E1/E2).** This follows Chaiyong Brahmawong's developmental testing ([Silpakorn Educational Research Journal](https://old.educ.su.ac.th/2013/images/stories/081957-02.pdf)):
- E1 is the mean percentage score on in-lesson tasks;
- E2 is the mean percentage score on the post-test;
- try-outs run one-to-one, then in a small group, then in the field.

Thai studies commonly report against an **80/80** criterion. Chaiyong reportedly recommends a stricter 85/85 or 90/90 for cognitive content, so verify which level to adopt and justify it. Recent Thai frameworks separate expert review from E1/E2 testing and then report an effectiveness index ([Pankaew et al. 2025](https://ph01.tci-thaijo.org/index.php/aer/article/download/265241/176295/1087438)).

**Effectiveness.** Report the Thai effectiveness index (ดัชนีประสิทธิผล, E.I.) alongside **Hake's normalised gain**, which uses the same formula, (post − pre)/(100 − pre) ([Hake 1998](https://doi.org/10.1119/1.18809)†). Also report **Hedges' g with a 95% confidence interval**. Two thresholds need checking before they are cited:
- the E.I. ≥ 0.50 target is a Thai convention that needs verification;
- Hake's bands (below 0.3 low, 0.3–0.7 medium) need the citation verified.

**Benchmarks for honest reporting.** Small pilots that use researcher-made tests inflate effect sizes. The SRI estimate of g ≈ 0.6 is the realistic benchmark, and large randomised trials of authentic data show d ≈ 0.1–0.2. Stating these benchmarks in the presentation reads as rigour, not weakness.

**Sample size.** At α = .05 and power .80:
- a one-group pre/post design needs about **34 students** to detect a medium effect (one intact class);
- a two-class comparison needs about **64 per arm**.

### Pilot timeline

| Stage | Window | Participants | Output for judges |
|---|---|---|---|
| A. Expert validation | 12–24 Nov | 3–5 experts: astronomy (e.g. a NARIT educator), science education, measurement, educational technology, an IPST-trained ม.3 teacher. **Avoid anyone likely to sit on the panel** | IOC table; lesson-plan suitability ratings |
| B. One-to-one try-out | 20–25 Nov | 3 students (weak, average, strong) | Usability fixes; quotes and footage for the video |
| C. Small-group try-out (about 1:10) and test try-out | 28 Nov – 11 Dec | 9–12 students; one non-sample class for item analysis | Preliminary E1/E2; item difficulty, discrimination and KR-20 |
| D. Field try-out | 14 Dec – 8 Jan | One intact class of at least 34, ideally in an ordinary OBEC school; optional comparison class | E1/E2, E.I. and normalised gain, Hedges' g, SUS, attitude change, CER samples, teacher interview |

Anything that will not exist by 27 Nov should appear in the entry as **design plus targets**, not results. The shortlist decision of 11 Dec rests on the design, and the 14 Jan final can show field data.

**Ethics.** Every secondary student is a minor under the PDPA, where the age of majority is 20. Consent-based processing for students aged 10 or over needs the minor's consent and the parent's consent ([PDPA s.20](https://pdpathailand.com/pdpa/content_eng/article20_eng.php)). Run the pilot with:
- anonymous codes;
- a Thai parent information sheet and consent form;
- the school director's written permission.

Check whether Chulalongkorn's research-ethics review applies if the results will be published.

## No existing tool joins the Earth view, the Moon view and a defensible decision

The competitive landscape divides cleanly:
- **International tools** have real data but no pedagogy, no Thai and no decision task.
- **Thai tools** have Thai language and curriculum alignment but stay in the Earth observer's frame and use no mission data.

| Tool | What it offers for Moon teaching | What it lacks for Thai ม.3 |
|---|---|---|
| NASA Moon Trek | Real LRO data; developers were adding solar-illumination line-of-sight and traverse planning for mission planning and public engagement ([EPSC 2022](https://meetingorganizer.copernicus.org/EPSC2022/EPSC2022-93.html)) | Expert GIS interface, no guided inquiry, no Thai |
| LROC QuickMap and LROC's activity on permanently shadowed regions | Expert lunar maps; a US instructor worksheet on shadowed regions ([LROC PSR activity](https://www.lroc.asu.edu/assets/educators/LROC_PSRactivity_part2_instructor-fe09f4153e04e167d2525c8f341ca094a399182203b83a720925d47fe735eb88.pdf)) | A worksheet, not an interactive decision; English |
| NASA SVS "Moon Phase and Libration, 2026" | Hourly NASA renders, including south-up and mobile versions ([SVS 5588](https://svs.gsfc.nasa.gov/5588)) | Passive media; Earth view only |
| NAAP Lunar Phase Simulator (UNL) | Links orbital position, phase and sky position; HTML5; student guide and pretest ([NAAP](https://astro.unl.edu/naap/lps/lps.html)) | Geometric model only; nothing from the lunar surface; English |
| Stellarium Mobile | Sky map; Plus features sold as in-app purchases (about US$1.99–18.99) | Thai absent from the iOS language list ([App Store](https://apps.apple.com/app/id1458716890)); no decision task |
| PhET | Light HTML5 sims | No Moon-phase simulation found in this research |
| KerbalEdu | Orbital mechanics game | Fictional bodies; a 2017 price of US$330 for a 25-seat pack ([Schlechty Center](https://www.schlechtycenter.org/blog/2017/5/31/kerbal-space-program)) |
| IPST AR apps (e.g. SciM1) | Thai AR media aligned to the textbook ([App Store](https://apps.apple.com/us/app/id1390225453)) | No confirmed Moon or space content; no real data or decisions |
| NARIT training and telescope loans | Hands-on phase observation in teacher training ([NARIT courses](https://old.narit.or.th/index.php/teacher/training/basic/training-courses)) | Earth-based observation; no lunar-surface or mission-data tool |
| DLTV and TruePlookpanya | Thai lesson plans and explainers ([DLTV](https://dltv.ac.th/utils/files/download/185601), [TruePlookpanya](https://www.trueplookpanya.com/learning/detail/33288)) | Broadcast and text; no simulation |

The gap LUNARIS can claim is this. No free, Thai-language, curriculum-mapped tool lets a secondary student:
1. take the Moon's point of view on real terrain;
2. explain from evidence why high south-pole ridges get near-continuous sunlight while crater floors stay dark;
3. find when Earth is visible for communications;
4. make and defend a landing decision with visible trade-offs and data provenance.

None of the tools reviewed shows where each number comes from or how certain it is. That provenance literacy maps directly onto ว 4.2 ม.3/3. It also gives the poster its most legible novelty claim.

Several details in the wider landscape come from background knowledge and should be checked before they appear in print:
- whether Stellarium Web supports Thai;
- PhET's Thai translations;
- Celestia, Google Earth's Moon mode and ESA Moon Camp.

## Thailand's own payload is bound for Shackleton in 2027

Few Thai educational innovations can claim a national event that lands in the same year as the award. LUNARIS can.

### Thailand's lunar programme

**Chang'e-7** carries **CE-7 MATCH**, Thailand's first lunar payload. It was designed and built entirely by Thai scientists and engineers at NARIT and Mahidol University to measure the radiation environment of the Sun–Earth–Moon system ([NARIT, 23 Aug 2026](https://www.narit.or.th/en/PressRelease-20260823-UPDATE-launch-of-LONG-MARCH-5-Y14)).

The launch, set for 24 Aug 2026, was **postponed to 2027**. NARIT explained that Chang'e-7 is aiming for **Shackleton crater near the lunar south pole** and that its lighting requirements could not be met in the 2026 window ([NARIT, 24 Aug 2026](https://www.narit.or.th/en/PressRelease-20260824-CE-7-MATCH)). No official new date had been published as of 9 Oct 2026 ([Space.com](https://www.space.com/space-exploration/launches-spacecraft/bad-weather-delays-launch-of-chinas-historic-change-7-mission-to-moons-south-pole)).

A launch delayed by south-pole lighting is the most persuasive hook available. LUNARIS lets a 14-year-old ask why lighting at Shackleton matters, and answer it with the same kind of computation.

Thailand's next instrument, **CE-8 ALIGN**, will look for south-pole water ice on Chang'e-8 around 2029 ([The Nation, Apr 2025](https://nationthailand.com/news/general/40049277)).

### Two programmes, one neutral tool

Thailand belongs to the China-led ILRS, joining at government level in April 2024 as its ninth member ([SpaceWatch.Global](https://spacewatch.global/2024/04/thailand-becomes-ninth-country-member-of-the-ilrs-program/)). It also signed the US-led **Artemis Accords** as the 51st signatory on 16 Dec 2024 ([NASA](https://www.nasa.gov/news-release/nasa-welcomes-thailand-as-newest-artemis-accords-signatory)). That makes Thailand the first country in both ([SCMP](https://scmp.com/news/china/science/article/3284728/thailand-set-be-first-country-join-chinese-and-us-led-space-initiatives)).

In August 2026 the National Space Policy Committee named Artemis a key Thai project. It also ordered reviews of the draft Space Activities Act and of the Space Master Plan, and noted work on upskilling a future space workforce ([Daily News, 18 Aug 2026](https://www.dailynews.co.th/news/6118058/)).

A tool built on NASA data that models the same south-pole region China is targeting is politically neutral and relevant to both of Thailand's lunar partnerships.

### Human capacity

Senior officials frame these missions as human-capacity projects. Deputy PM and MHESI Minister Yodchanan (Yotsanan) Wongsawat said:
- of the TSC-1 satellite, that building it "inspires the younger generation to see that space is not so far away for Thais" ([Thairath English, Apr 2026](https://en.thairath.co.th/news/politic/2927487));
- of the Chang'e-7 launch, "We want Thai children to see this historic moment live" ([The Nation, 4 Aug 2026](https://www.nationthailand.com/news/general/40069400)).

MHESI and the Ministry of Education planned to broadcast that launch to **more than 3 million students**. The precedent shows that the two ministries already treat Thailand's lunar missions as teaching moments.

The National Space Master Plan 2023–2037 has eight strategies ([The Nation](https://www.nationthailand.com/thailand/policies/40023060)). Thai press list human-capacity development as Strategy 6 ([Naewna](https://www.naewna.com/politic/697838)). Cite it as "under revision" and verify the strategy number. Describe the Space Activities Act as a long-pending draft, not law.

No MOE minister statement linking lunar exploration to STEM was found. LUNARIS's honest position is therefore the **bridge between MHESI's missions and MOE's classrooms**.

### Education policy

Education policy adds four further alignments.

1. **Ministerial priorities.** Minister Prasert Jantararuangtong's 2026 priorities are ([Bangkok Insight](https://www.thebangkokinsight.com/news/politics-general/politics/1640918/)):
   - moving from rote memorisation to practical application;
   - the competency-based curriculum;
   - judicious use of AI;
   - PISA 2029 readiness;
   - giving time back to teachers ("คืนเวลาให้ครู").
2. **The AI Literacy Framework.** MOE promised to publish it by the end of November 2026 ([Kroobannok](https://www.kroobannok.com/93823)). It should be checked as soon as it appears, so that LUNARIS's data-credibility activities can be mapped to it. **50.7%** of Thai students already use AI at least weekly ([The Nation](https://www.nationthailand.com/news/policy/40070867)), so teaching them to ask where a number comes from is a transferable habit.
3. **"เรียนดี มีความสุข".** This is the FY2568–2569 policy, and its items include "Anywhere Anytime" learning on free platforms and science and technology skills ([MOE360](https://moe360.blog/2024/11/13/131167/)). Whether the slogan carries into FY2570 policy is unverified.
4. **The device programme and computing.** The Anywhere Anytime programme rents more than 600,000 devices and earmarked a 21st-century-skills learning platform ([Thai PBS Policy Watch](https://policywatch.thaipbs.or.th/policy/education-5)). Computing science (วิทยาการคำนวณ) has been compulsory since 2018 ([Informatics in Education](https://infedu.vu.lt/journal/INFEDU/article/697/file/pdf)).

## Thai classrooms demand a phone, projector and no-login design

The "appropriate technology" criterion will be judged against Thai school reality, not against the Overview page's polish.

**Connectivity and devices**
- **97.47%** of OBEC schools were connected to the internet, but OBEC records **no data on speed or quality** ([ITU 2022](https://thailand.un.org/sites/default/files/2022-09/21-00630_E-learning-Thailand-Mapping-digital-divide%5B74%5D.pdf)).
- One in three principals reported insufficient bandwidth, with worse figures in rural and public schools ([ITU 2022](https://thailand.un.org/sites/default/files/2022-09/21-00630_E-learning-Thailand-Mapping-digital-divide%5B74%5D.pdf)).
- Schools average about **17 students per computer**, and smartphones are students' main device ([ITU 2022](https://thailand.un.org/sites/default/files/2022-09/21-00630_E-learning-Thailand-Mapping-digital-divide%5B74%5D.pdf)).
- Leased iPads reached upper-secondary students only in early 2026, and unevenly ([Sangkha School](https://sangkha.ac.th/4306/); [kidforkids](https://kidforkids.org/anywhere-anytime/)).
- WebGL2 itself is supported in about 97.5% of browsers, so the binding constraints are budget GPUs and shared bandwidth, not API support ([web3dsurvey](https://web3dsurvey.com/webgl2)).

**Teachers**
- **74%** of surveyed teachers lack a framework for integrating digital tools ([EdTech Hub 2025](https://edtechhub.org/2025/08/07/building-competencies-for-a-digital-age)).
- Small-school teachers teach **27.31 hours a week, 37.6% above the MOE standard** ([Thansettakij on EEF](https://www.thansettakij.com/general-news/649108)).

**Language, law and channels**
- Thailand ranks **116th of 123** on the EF English Proficiency Index ([EF EPI 2025](https://www.ef.com/assetscdn/WIBIwq6RdJvcD9bc8RMd/cefcom-epi-site/fact-sheets/2025/ef-epi-fact-sheet-thailand-english.pdf)), so an English-only interface is a hard barrier for most students.
- The PDPA makes every secondary student a minor, so any personal data the platform collects triggers consent and notice duties ([PDPA s.20](https://pdpathailand.com/pdpa/content_eng/article20_eng.php)).
- LINE reaches about 54 million Thai users ([LY Corp](https://www.lycorp.co.jp/en/story/20251205/line_thailand.html)), so share links will open inside its in-app browser.

The table below turns these constraints into requirements and records where LUNARIS stands today. The numeric targets are engineering judgements, not Thai standards, and should be confirmed in field tests.

| Requirement | Driver | LUNARIS today | Action |
|---|---|---|---|
| Thai-first interface using Royal Society astronomy terms ([พจนานุกรมศัพท์ดาราศาสตร์](https://www.chulabook.com/en/education/205472)), with an EN toggle for EP/MEP programmes | Very low English proficiency; national platforms are Thai | English only; `html lang="en"`; strings hard-coded; no i18n framework | P0 for the lesson route; the rest later |
| No dependence on a sleeping server | 30–40 students press start together | Both the web and API run as Render free Docker services that sleep after about 15 minutes idle and take about a minute to wake | P0: precomputed lesson data served statically; API optional |
| First interaction under about 3 MB; usable at about 1 Mbit/s per device | ITU puts web-based learning at 0.5–1.4 Mbit/s per device | Unmeasured | P1 performance budget |
| Runs on budget Android phones, iPad Safari, Chromebooks and integrated-GPU PCs; adaptive quality; 2D fallback | Mixed fleet; old lab PCs | Not tested on low-end devices; no non-WebGL mode | P0 smoke test; P1 fallback |
| Teacher projector mode | 17 students per computer; ม.3 students lack devices | None | P1 |
| No student login and no personal data | PDPA s.20 | Already met: the app has no accounts | Keep; class codes later must stay anonymous |
| Ready-to-teach Thai kit in the OBEC format | Teacher workload; 74% lack an integration framework | None | P0 |
| Zero-install sharing: short URL plus QR code, working in the LINE in-app browser and Google Classroom | LINE reach; Classroom in use | URL only; LINE browser untested | P0 test, P1 QR |
| Offline or PWA lesson pack | Unstable rural links; about 6% of schools on 3G/4G | None | P2 |
| WCAG 2.1 AA ([DGA standard](https://standard.dga.or.th/wp-content/uploads/2023/07/PH-GovWebsite3_v.01.pdf)) | Thai government web standard | Contrast unit tests exist; 3D keyboard access and alt text not audited | P2 |

## Free for schools, sustained by training and partners

The "practical use and commercial potential" criterion is best met with a model that keeps the tool **free at the point of use**. Public schools face slow procurement, and a single-topic tool cannot support school subscriptions.

The recommended model is a free open core sustained by three sources:
- **paid or sponsored teacher workshops and certification**, delivered through the Faculty of Education network or partner universities;
- **partner-funded deployment**;
- **services** such as custom site packs or Thai-mission modules.

### Partners and channels

Partners and channels already exist.
- **NARIT** has trained over 8,000 teachers since 2010. It lends 10-inch Dobsonian telescopes to schools in all 77 provinces and runs an annual school-astronomy conference ([NARIT teacher programme](https://www.narit.or.th/en/public-outreach/teacher)). A "digital companion to the NARIT telescope schools" is a natural pitch.
- **IPST** runs an online teacher-training system that can host a short course ([IPST training-system manual](https://www.ipst.ac.th/wp-content/uploads/2025/04/คู่มือการให้บริการระบบอบรมครู.pdf)).
- **MOE's DEEP platform** lets private organisations act as content creators ([Nation Thailand](https://www.nationthailand.com/news/30393797)).
- **OBEC Content Center** hosts digital learning media for teachers and students ([kroowit](https://www.kroowit.in.th/content-center)).

The central Anywhere Anytime learning-platform procurement was halted in 2025 ([kidforkids](https://kidforkids.org/anywhere-anytime/)). That leaves room for lightweight, interoperable content to fill the devices, and it is a timely argument for judges.

### Precedents and further steps

Thai precedents show the shape of scale. StartDee began as a free app in 2020 and later added paid lines after passing 2 million downloads ([Thansettakij](https://www.thansettakij.com/technology/529829)).

Satit Chula's track record shows a route from this award to invention expos. Its students won 30+ awards at Thai Inventors' Day 2569 ([Chula news](https://www.chula.ac.th/news/281956/)). A strong showing here could therefore lead to I-New Gen or international expos.

### Phased plan for the entry form

1. **Phase 1, 2027:** a pilot with Satit Chula and one ordinary OBEC school, plus an open release of the kit.
2. **Phase 2:** a NARIT or IPST partnership and listing on DEEP and the OBEC Content Center.
3. **Phase 3:** training and certification revenue, a ม.6 celestial-sphere module, and Thai lunar-mission content updates as Chang'e-7 and Chang'e-8 fly.

The team should **measure the real static-hosting and bandwidth cost** of the lesson pack before quoting a cost per student. No sourced figure exists yet, and an invented one would undermine an otherwise honest entry.

## Sixteen days to submission: build four things, then pilot

The submission package has three parts, all due by 27 Nov at 16:30:
- a PDF entry form of at most 10 MB;
- a 3-minute landscape MP4 video;
- an A0 poster on the official template.

The video and poster need real screenshots of a **Thai lesson flow**, so the P0 builds must be done by about 22 Nov. That leaves three days to capture footage and lay out materials.

The plan below gives effort in person-days. These are planning estimates, not measurements. Code locations refer to the current repository.

| Priority | Build item | Where | Criterion served | Effort | Done by |
|---|---|---|---|---|---|
| **P0** | **Classroom route** (`/learn`, "ห้องเรียน"): six mission steps mirroring the unit table; progressive disclosure; limited controls first; reuses existing globe, sky-chart and Compare components | New `apps/web/src/app/learn/` | Creativity and design; practicality | 3–4 | 21 Nov |
| **P0** | **Thai-first i18n for the lesson route and shared chrome**: message catalogue, `lang="th"` on lesson pages, Thai web font (e.g. Sarabun or Noto Sans Thai), Royal Society terms, EN toggle keeping the current English | `apps/web/src/app/layout.tsx`; new `lib/i18n` | Appropriate technology | 2–3 | 21 Nov |
| **P0** | **"View from Earth" camera preset** plus a phase readout (% illuminated, waxing or waning, Thai phase name), driven by the sub-Earth direction the science core can already compute from its DE440 Earth ephemeris | `components/viewport/camera-rig.tsx`; small API or snapshot field | Curriculum claim for ม.3/3 | 1–2 | 19 Nov |
| **P0** | **Static lesson data**: a script captures the API responses the lesson needs (Sun series, site ephemerides, timeline, comparison, terrain scene) for the demo trio over a 2027 lunation; the web client reads them through a snapshot `fetchImpl`, so lessons never wait for Render | `scripts/`, `apps/web/public/lesson-pack/`, `lib/api/client.ts` | Reliability; appropriate technology | 2 | 21 Nov |
| **P0** | **Thai teaching kit v1**: six-period แผนการจัดการเรียนรู้, ใบงาน 1–3, decision-memo template, answer keys, rubric, test blueprint and items sent for IOC | Documents, not code | Practical use; presentation | 3 (teacher-led, in parallel) | 18 Nov (IOC forms out) |
| **P0** | Smoke tests on one budget Android phone, an iPad in Safari and the LINE in-app browser; end-to-end tests for the Thai lesson route; keep all existing suites green | `apps/web/e2e` | Appropriate technology | 1 | 22 Nov |
| P1 | Teacher projector mode: large type, step-through narration, hidden controls | `/learn` | Practicality | 1–2 | 11 Dec |
| P1 | 2D fallback (pre-rendered phase images, SVG sky chart) chosen automatically when WebGL fails or frame time stays above about 40 ms; doubles as an accessibility mode | Viewport | Appropriate technology; equity | 2–3 | 11 Dec |
| P1 | Performance budget: first load under about 3 MB, 1K textures and a device-pixel-ratio cap of 1.5 or less on mobile | Web | Appropriate technology | 2 | 11 Dec |
| P1 | **Bangkok sky lane**: moonrise and moonset times for a Thai observer across the lunation; check that the generic kernels support an Earth-surface observer | Science core plus snapshot | ม.3/3 moonrise timing | 2–3 | 20 Dec |
| P1 | **Spring/neap (น้ำเกิด/น้ำตาย) indicator** from the Sun–Moon angle, labelled as a qualitative model and not a tide prediction | Lesson route | Closes the tides caveat | 1 | 20 Dec |
| P1 | In-app CER prompts and one worked-example site | Lesson route | Guidance evidence | 1–2 | 20 Dec |
| P2 | Offline/PWA cache of the lesson pack; QR codes | Web | Rural reliability | 2 | 10 Jan |
| P2 | CSV export for box plots (ค 3.1) and optional coding (ว 4.2 ม.3/1) | Compare/Terrain | Indicator reach | 1 | 10 Jan |
| P2 | Teacher micro-PD video (1–2 h) and teacher guide; WCAG 2.1 AA pass on the lesson route | Kit and web | TPACK; accessibility | 3 | 10 Jan |
| P3 (2027) | ม.6 celestial-sphere module (horizon coordinates, local lunar noon); Chang'e-7 launch-day scenario; anonymous class codes with a teacher view; DEEP and Content Center listing | Later | Scale | — | After the award |

The team should deliberately **not** build:
- VR;
- student accounts;
- an AI tutor;
- a rebuilt science core.

Each would cost scarce days and none moves a judging criterion. The validated core is already the strongest technical asset.

### Calendar

| Date | Milestone |
|---|---|
| 11–14 Nov | Freeze scope; confirm entrant category and partner school; recruit 3–5 IOC experts; plan around the NASA Space Apps weekend (14–15 Nov) if team members overlap |
| 15–21 Nov | Build the P0 items; kit draft; IOC forms returned by 24 Nov |
| 20–25 Nov | One-to-one try-out with 3 students; film classroom footage |
| 24–26 Nov | Edit the 3-minute video; lay out the A0 poster; compile the entry form under 10 MB; **submit on 26 Nov** to keep a day's buffer |
| 28 Nov – 11 Dec | P1 builds; small-group try-out; test item analysis; shortlist announced 11 Dec |
| 14 Dec – 8 Jan | Field try-out with one class; P2 builds; analysis |
| 9–13 Jan | Final deck; rehearse the live demo on the venue network, with the offline pack and a recorded fallback |
| 14–15 Jan 2027 | Final presentation; awards on Thai Teachers' Day |

### Poster and video content

The poster template's sections map directly onto this report.
- **Background, rationale and objectives:** the O-NET strand-3 figure, the shadow misconception, PISA 2025 and the Chang'e-7 lighting delay.
- **Features:** the Earth view, the lunar sky chart, Pareto comparison and evidence labels.
- **How it works:** the six-period 5E strip.
- **Highlights and novelty:** two viewpoints, one decision, and provenance on every number.
- **Use and benefits:** the indicator table and the pilot design or results.

The video should follow one student through the arc: **wrong prediction, Earth-view surprise, standing at Shackleton, team decision.** It should not tour the feature list.

## Risks that could cost the entry, with mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Overclaiming curriculum coverage | Judges in a Faculty of Education will read the indicators; tides and "สร้างแบบจำลอง" are not met by software alone | Grade each claim strong, partial or weak; include the physical model and the spring/neap plan; never claim the ป.6 eclipse indicator for secondary |
| Cold start or overload during a class or the live final | Free Render services sleep, and 40 simultaneous loads hit one small instance | Static lesson pack; offline cache; a recorded demo for the final; consider a paid always-on instance or static hosting (terms and cost unverified) |
| Cognitive overload of the 3D views for weak students | WWT found that low-prior-knowledge students struggle with complex 3D | Physical model first; process constraints; worked example; 2D fallback |
| Pilot timing and validity | The ม.3 unit is probably already taught; one-group designs are weak | Frame as consolidation; add a comparison class or a ม.6 group if possible; report benchmarks honestly |
| A pilot only at a demonstration school | Demonstration schools are the national outlier | Add a small group at an ordinary OBEC school |
| Thai translation errors or non-standard terms | Credibility with Thai educators | Royal Society dictionary; review by a Thai science teacher; bilingual glossary |
| PDPA or ethics challenge | All participants are minors | Anonymous codes, parental consent, director approval, no server-side personal data |
| Ineligible or ambiguous entrant | Categories are teacher or student-with-advisor | Confirm the rules and the co-inventor listing now |
| Confusion with the colleague's Space Apps 2026 project | Originality and authorship questions | Separate naming and repositories; state the adaptation history in the form |
| Team bandwidth over the 14–15 Nov Space Apps weekend | Up to two of the 16 days lost | Assign the P0 owners who are not at the hackathon |
| A Chang'e-7 date change or new delay | The hook ages | Phrase it as "scheduled for 2027"; make the launch-day scenario parametric |
| Effect sizes look implausibly large | Small researcher-made tests inflate effects | Report Hedges' g with a confidence interval against the SRI and RCT benchmarks |

## Verify these items before 27 November

| Item | Current status | Action |
|---|---|---|
| ม.3 unit placement (เล่ม 1 or 2; semester) | Secondary sources, one conflicting | Check IPST Project 14 or the textbook; ask the partner school |
| Indicator wording for ม.6 and primary | OBEC Google Doc only (ม.3 is double-sourced) | Check against the printed OBEC/IPST indicator book |
| Entrant category, co-inventor and advisor rules, rubric weights | The official rubric was not found online | Ask the Faculty of Education organisers |
| IPST's official 5E source | Not found | Cite an IPST teacher's guide that describes 5E |
| PISA 2025 science subscale "interpret data and evidence" for Thailand; the sampling note | The OECD country note returned 403 | Pull from OECD Volume I or the IPST PISA site |
| O-NET 2568 results | Not found | Check niets.or.th; update the strand figure if newer data exist |
| Chang'e-7 launch date | No official date as of 9 Oct 2026 | Check NARIT and CNSA on the submission day |
| MOE AI Literacy Framework | Due end of Nov 2026 | Map the data-credibility activities if it includes data literacy |
| Thai wording of the competency-based curriculum competencies; secondary framework status | Unverified | Check OBEC and OEC documents |
| E1/E2 level (80/80 vs 85/85), the E.I. ≥ 0.50 target, Likert interpretation bands, the SUS benchmark of 68 | Conventions not verified at source | Confirm with a measurement expert or a Thai methods text |
| Permissions to use and translate the MPCI and LPCI | Unknown | Check PhysPort and APS terms |
| Need for an ethics review | Unknown | Ask the Faculty of Education or the partner school |
| Render static or paid hosting terms and cost | Background knowledge only | Check Render's current pricing |
| Standard citations marked † (Windschitl, Mayer, TPACK, Hake) | DOIs not re-verified | Resolve each DOI |
| Figures to leave out | TIMSS 2023 (Thailand absent); the rural "three-year" gap; the 15% out-of-field rate; IMARC market size; Edsy school counts | Do not cite |

## Conclusion

The pivot works because the hardest part of the original project is also what Thai astronomy teaching lacks most: a validated geometry engine that shows the same Sun–Earth–Moon system from several viewpoints. LUNARIS was built to answer where a lander should go. Repurposed, it can answer why the Moon changes shape and why a lander cares, from the classroom of a country that is sending its own instruments to that exact region.

That reframing changes what "done" means. Rendering polish and new science matter less in the next 16 days than four unglamorous builds (Thai text, an Earth-view camera, static lesson data and a printable kit) and an honest evaluation that speaks both Thai R&D conventions and international effect sizes.

The strategic insight for the final is that the evidence base and the policy moment point the same way. Guided, multi-session, curriculum-embedded simulation has the strongest effects. Thailand's ministries have already decided that lunar missions belong in classrooms. An entry that shows a ม.3 student in an ordinary OBEC school dropping the Earth's-shadow explanation, and then defending a Shackleton landing site with labelled evidence, is the clearest way to show judges both.
