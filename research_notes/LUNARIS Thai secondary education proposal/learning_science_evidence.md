# Learning-science evidence base and pedagogical/assessment design for LUNARIS (simulation-, visualization- and authentic-data-based lunar science for Thai secondary schools)

Notes compiled 11 Nov 2026. Verification legend used throughout:
- **[V]** = verified in this session against the primary source text, an official abstract, or a publisher/indexing page.
- **[S]** = taken from a search-result snippet or secondary summary; plausible but not checked against full text.
- **[PK]** = standard citation from established literature (prior knowledge). The DOI/details were NOT re-verified in this session and should be checked before final submission.

---

## Q1. Meta-analyses of computer simulations, virtual labs, interactive visualizations and VR/AR in science education

### Takeaway
Across several large meta-analyses, interactive simulations give moderate-to-large gains over instruction without simulations. The key K-12 STEM figure is g = 0.62 for achievement (SRI/D'Angelo et al. 2014; science-only g = 0.67). Adding scaffolding to a simulation adds about g = 0.5 more. Virtual and physical investigation give equivalent conceptual learning (g ≈ −0.14, n.s.). Immersive VR headsets add little overall (ES = 0.24). Effects are largest when simulations are embedded in a curriculum and supported by guidance. That is the design case for LUNARIS as a guided, curriculum-embedded web simulation rather than a stand-alone or VR product.

### Cited Findings

**D'Angelo et al. (2014), SRI International, *Simulations for STEM Learning: Systematic Review and Meta-Analysis*. Funded by the Gates Foundation. K-12, studies published 1991–2012 [V]**
- Of 201 full-text candidates, 59 studies met the criteria. They yielded 128 effect sizes: 96 for achievement, 17 for scientific inquiry and reasoning, and 15 for non-cognitive outcomes. — [SRI Executive Summary PDF](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
- Overall random-effects averages: achievement g+ = 0.55 (k = 96); inquiry and reasoning g+ = 0.36 (k = 17); non-cognitive g+ = 0.66 (k = 15). Fail-safe N for achievement was 8,909, and trim-and-fill left the estimate unchanged. — [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
- RQ1, simulation vs. no simulation, achievement: g+ = 0.62 (k = 46, SE 0.09, 95% CI 0.45–0.79). Science studies alone gave g+ = 0.67 (k = 42, CI 0.50–0.84). Mathematics gave g+ = −0.15 (k = 4, n.s.). — [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
- RQ2, simulation plus modification vs. non-modified simulation, achievement: g+ = 0.49 (k = 50, CI 0.36–0.61). The SRI brief describes this as an "improvement index" of 19 percentile points. — [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf); [SRI Brief](https://www.sri.com/wp-content/uploads/2022/04/simulations-for-stem-learning-brief.pdf)
- Inquiry and reasoning skills: RQ1 g+ = 0.26 (k = 6, CI −0.03 to 0.55, n.s.); RQ2 g+ = 0.41 (k = 11, significant). Non-cognitive outcomes: RQ1 g+ = 0.69 (k = 12); RQ2 g+ = 0.52 (k = 3). — [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
- Moderators, science only, RQ1:
  - Curriculum integration: simulation embedded in the curriculum g+ = 0.81 (k = 22); stand-alone but related g+ = 0.53 (k = 12); stand-alone and unrelated g+ = 0.20 (k = 2, n.s.).
  - Simulation type: agent-based 0.78, phenomenon-based 0.71, virtual labs 0.68. These do not differ significantly.
  - Number of sessions: 4–6 sessions g+ = 0.91 (k = 9); a single session 0.49 (k = 11).
  - Source: [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
- Moderators, RQ2 (type of modification): scaffolding g+ = 0.60 (k = 19); added representations 0.32 (k = 19); cooperative learning 0.69 (k = 4); feedback 0.54 (k = 2); haptic 0.43 (k = 3). Between-group Q was not significant (p = .37). — [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
- Study design did not bias the results. For achievement, RCTs gave g = 0.52 (k = 32) and quasi-experimental designs g = 0.57 (k = 64), Q-between p = .67. — [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
- Full report landing page: [SRI full report](https://www.sri.com/publication/education-learning-pubs/stem-and-computer-science-pubs/simulations-for-stem-learning-systematic-review-and-meta-analysis-full-report/)

**Rutten, van Joolingen & van der Veen (2012). The learning effects of computer simulations in science education. *Computers & Education*, 58(1), 136–153. doi:10.1016/j.compedu.2011.07.017 [V, abstract level]**
- This is a narrative review of about a decade of (quasi-)experimental studies, not a pooled meta-analysis. Its conclusions:
  - Simulations can successfully enhance traditional instruction.
  - Using simulations as preparation for laboratory work is effective.
  - Improved visualizations do not necessarily translate into better learning.
  - Source: [LearnTechLib record](https://learntechlib.org/p/50686)

**Smetana & Bell (2012). Computer simulations to support science instruction and learning: A critical review of the literature. *International Journal of Science Education*, 34(9), 1337–1370. doi:10.1080/09500693.2011.605182 [V, abstract level]**
- Reviewed 61 empirical studies. Simulations improved content knowledge and process skills, but teacher guidance and support were critical. Simulations work best as supplements, with strong support structures, student reflection, and cognitive dissonance. — [NAAEE research summary](https://eepro.naaee.org/eepro/research/library/computer-simulations-support-science); [Loyola record](https://scholars.luc.edu/en/publications/computer-simulations-to-support-science-instruction-and-learning-/)
- The SRI executive summary says this review found that most of the studies (49 of 61) showed positive impacts of simulations. — [SRI Executive Summary](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)

**Chernikova, Heitzmann, Stadler, Holzberger, Seidel & Fischer (2020). Simulation-based learning in higher education: A meta-analysis. *Review of Educational Research*, 90(4), 499–541. doi:10.3102/0034654320933544 [V via indexing pages]**
- 145 studies. Overall g = 0.85 (SE 0.08, 95% CI 0.69–1.02) for complex-skill learning. Scaffolding and technology both had positive effects.
- Prior knowledge mattered:
  - Learners with low prior knowledge benefited more from worked examples.
  - Learners with high prior knowledge benefited more from reflection phases.
- Sources: [TUM portal](https://portal.fis.tum.de/en/publications/simulation-based-learning-in-higher-education-a-meta-analysis/); [Open-access PDF (LMU)](https://epub.ub.uni-muenchen.de/84298/1/0034654320933544.pdf)
- A 2024 follow-up by the same group (214 studies, *Zeitschrift für Pädagogische Psychologie*) found that salience of relevant information explained variation in effectiveness more than authenticity did [S]. — [TUM portal](https://portal.fis.tum.de/en/publications/where-salience-goes-beyond-authenticity-a-meta-analysis-on-simula/)
- Caveat: the sample is higher education, not secondary.

**Muilwijk & Lazonder (2023). Learning from physical and virtual investigation: A meta-analysis of conceptual knowledge acquisition. *Frontiers in Education*, 8, 1163024. doi:10.3389/feduc.2023.1163024 [V]**
- 35 studies, N = 3,303. Overall virtual vs. physical: g = −0.14 (SE 0.09, 95% CI −0.33 to 0.06, p = .152). The authors conclude there is "no overall advantage of either mode of investigation." — [Frontiers full text](https://www.frontiersin.org/articles/10.3389/feduc.2023.1163024/full)
- Moderators:
  - Age: children g = 0.22, adolescents g = −0.04, adults g = −0.38 (negative values favor virtual).
  - Tactile relevance: when touch was irrelevant, g = −0.30 (k = 20), favoring virtual.
  - Classroom setting g = −0.24 (k = 31).
  - Source: [Frontiers full text](https://www.frontiersin.org/articles/10.3389/feduc.2023.1163024/full)

**Recent domain-specific meta-analyses (2023–2025) [S]**
- Physics, secondary level: virtual simulations on achievement, weighted Hedges g = 0.941 across 15 studies; no significant moderators. This is a small and unusually large estimate, so cite with caution. — [Antonio & Castro 2023, International Journal of Instruction PDF](https://www.e-iji.net/dosyalar/iji_2023_2_29.pdf)
- Engineering education virtual labs: g = 0.686 (95% CI 0.414–0.959), 46 studies. Published in PLOS ONE, article e0316269; the year is listed as 2024 in one source and implied as 2025 by the article number. — [EconPapers record](https://econpapers.repec.org/RePEc:plo:pone00:0316269)
- Second-order review of online labs in high-school STEM: online labs support learning to an extent comparable to real labs, with stronger results when they supplement traditional teaching. — [Fadda et al. 2022, DOAJ record](https://doaj.org/article/f97dae2f4f214afab08e8f80db5bd914)

**VR / AR / 3D meta-analyses**
- **Merchant, Goetz, Cifuentes, Keeney-Kennicutt & Davis (2014). Effectiveness of virtual reality-based instruction on students' learning outcomes in K-12 and higher education: A meta-analysis. *Computers & Education*, 70, 29–40.** [S, abstract]
  - Fixed/random-effects estimates: games 0.77 / 0.51 (13 studies, N = 3,081); simulations 0.38 / 0.41 (29 studies, N = 2,553); virtual worlds 0.36 / 0.41 (27 studies, N = 2,798).
  - Games gave higher gains than simulations and virtual worlds. Students did better working individually than in groups.
  - The abstract snippet mislabels the 29-study category as "games"; it is the simulation category.
  - Sources: [e-teaching.org summary](https://www.e-teaching.org/materialien/literatur/merchant-goetz-cifuentes-keeney-kennicutt-davis-2014); [dblp](https://dblp.uni-trier.de/rec/journals/ce/MerchantGCKD14.html)
- **Wu, Yu & Gu (2020). Effectiveness of immersive virtual reality using head-mounted displays on learning performance: A meta-analysis. *British Journal of Educational Technology*, 51(6), 1991–2005. doi:10.1111/bjet.13023** [V, abstract]
  - Head-mounted-display VR beat non-immersive approaches with a small effect (ES = 0.24, random effects; about 35 studies). The effect was larger for K-12 learners, in science education, and for simulation or virtual-world representations. — [Zendy record](https://zendy.io/title/10.1111/bjet.13023)
  - A citing paper reports the K-12 subgroup as g = 0.80 vs. post-secondary g = −0.02 [S]. — [Springer, JSET 2023](https://link.springer.com/10.1007/s10956-023-10032-5)
- **Garzón & Acevedo (2019). Meta-analysis of the impact of augmented reality on students' learning gains. *Educational Research Review*, 27, 244–260.** [V, abstract]
  - 64 studies (N = 4,705, 2010–2018). AR has a medium effect, d = 0.68. — [LearnTechLib](https://learntechlib.org/p//209849)

### Inferences
- The strongest and most defensible headline for judges is D'Angelo et al.: science simulations vs. no simulation g = 0.67, and scaffolded vs. unscaffolded simulation g = 0.49. Both are K-12, from 59 studies, and robust to publication-bias tests.
- LUNARIS's design choices map directly onto the moderators with the largest effects:
  - **Embedded in the curriculum** (g = 0.81 vs. 0.20 when unrelated): the IPST 5E unit plan is the embedding.
  - **4–6 sessions** (g = 0.91): plan a multi-lesson unit rather than a single demo period.
  - **Scaffolding** (g = 0.60): guided worksheets, prompts, and evidence labels.
- Muilwijk & Lazonder (2023) support positioning LUNARIS as a complement to hands-on lamp-and-ball modelling, not a replacement. For adolescents, virtual and physical modes are equivalent; physical models add tactile and embodied value.
- VR headsets add little overall (0.24) and are costly. A browser-based 3D globe on ordinary school computers or tablets is consistent with the evidence and more equitable for Thai schools. This is an inference; no cost-effectiveness study was found.
- Expect a smaller effect for "inquiry/reasoning skills" (0.26–0.41) than for content achievement (0.55–0.67). Set realistic targets for pilot outcomes.

### Gaps
- The full SRI report, rather than the executive summary, may contain grade-band moderators (middle vs. high school). Not checked.
- More recent large K-12 science simulation meta-analyses from 2018–2025 exist, but none was verified here. Candidates that were not verified: Coban, Bolat & Goksu (2022), immersive VR meta-analysis in *Educational Research Review*; Villena-Taranilla et al. (2022), VR in K-6. — [Coban et al. record](https://gcris.artuklu.edu.tr/entities/publication/938a0d60-4ab6-4e76-99c5-3b4a1972092f)
- No meta-analysis specific to astronomy simulations or planetarium software (e.g., Stellarium) was found.
- A Turkish meta-analysis reporting a combined ES of 6.85 for virtual labs appeared in search results. It is implausible and should not be cited.

---

## Q2. Astronomy-specific evidence: simulations and 3D models for Moon phases, Sun–Earth–Moon geometry and spatial reasoning

### Takeaway
Astronomy education research consistently finds two things. Moon-phase and eclipse misconceptions are widespread and resistant to change. Understanding depends on spatial thinking: coordinating Earth-based ("what I see in the sky") and space-based ("view from outside") frames of reference. Instruction that combines 3D computer models with observation, prediction and perspective-taking produces large pre/post gains. The cleanest effect sizes come from small or conference-level studies, so present them as supportive, not definitive.

### Cited Findings
- **Plummer (2014). Spatial thinking as the dimension of progress in an astronomy learning progression. *Studies in Science Education*, 50(1).**
  - Argues that spatial thinking is the core dimension of progress in learning about daily celestial motion and lunar phases. — [PDF via indico.unina.it](https://indico.unina.it/event/73/contributions/1042/attachments/359/649/2014_-_Review_Spatial_Thinking.pdf) [S]
  - DOI 10.1080/03057267.2013.869039 [PK].
- **Plummer & Krajcik (2010). Building a learning progression for celestial motion: Elementary levels from an earth-based perspective. *Journal of Research in Science Teaching*, 47(7), 768–787. doi:10.1002/tea.20355.**
  - Learning progressions depend on instruction and are not inevitable stages. — [Deep Blue record](https://deepblue.lib.umich.edu/handle/2027.42/84389?show=full); [Zendy](https://zendy.io/title/10.1002/tea.20355) [S]
- Plummer's seasons work (JRST, doi:10.1002/tea.21151): students must learn to coordinate Earth-based and space-based perspectives to interpret what they observe. — [PDF](https://indico.unina.it/event/73/contributions/1042/attachments/359/645/2014_-_An_Exploration_of_Students_Reasoning_About_the_Seasons.pdf) [S]
- **Kavanagh, Agan & Sneider (2005). Learning about phases of the Moon and eclipses: A guide for teachers and curriculum developers. *Astronomy Education Review*.**
  - Misconceptions about Moon phases and eclipses are widespread and resistant to change, even among adults.
  - The most common is confusing the two, i.e., believing phases happen when the Moon enters Earth's shadow.
  - US standards expect students to explain phases and eclipses by the end of Grade 8.
  - Source: [iSTAR AER database entry](https://istardb.org/aerpublications/learning-about-phases-of-the-moon-and-eclipses-a-guide-for-teachers-and-curriculum-developers/) [S]. Volume and pages (AER 4(1), 19–52) are [PK].
- **Küçüközer, Korkusuz, Küçüközer & Yürümezoğlu (2009). The effect of 3D computer modeling and observation-based instruction on the conceptual change regarding basic concepts of astronomy in elementary school students. *Astronomy Education Review*, 8(1).**
  - 131 Grade-6 students (aged 11–13). A predict-observe-explain strategy with 3D computer modelling plus sky observation was "significantly effective" for conceptual change. — [PDF](https://istardb.org/wp-content/uploads/tainacan-items/1018/18872/Kucukozer-et-al.-2009-The-Effect-of-3D-Computer-Modeling-and-Observation.pdf) [S]
  - A companion paper (Küçüközer et al. 2008, *Physics Education* 43(6)) found 3D modelling effective for conceptual change on seasons and Moon phases (n = 76). — [Balıkesir repository](https://acikerisim.balikesir.edu.tr/xmlui/handle/20.500.12462/9660) [S]
- **WorldWide Telescope (WWT) "Visualization Lab" (Harvard-Smithsonian CfA; Udomprasert, Goodman, Sunbury, Dussault et al.)**
  - Middle-school Moon-phases lab combining physical models with a 3D WWT model; compared against a 2D textbook simulator.
  - Students with low prior knowledge had difficulty interpreting the complex 3D visualization.
  - The pre-test spatial-skills "cube" item was the only significant predictor of post-test score.
  - Sources: [ICLS 2014 paper](https://wwtambassadors.org/resource/2014iclswwtmoonpdf); [Visualizing Moon Phases with WWT (ASP 2014)](https://wwtambassadors.org/publications/visualizing-moon-phases-worldwide-telescope) [S; full text blocked (HTTP 403) in this session]
  - Follow-up work tested the optimal order of physical vs. virtual model components. — [Optimal model order abstract](https://istardb.org/aerpublications/optimal-model-order-for-a-moon-phases-lab-with-virtual-and-physical-components/) [S]
- **ThinkSpace (CfA) pilot, AAS 2016 slides.**
  - Three-day Moon phases and eclipses lab emphasizing perspective-taking. 11-item distractor-driven pre/post test.
  - Cohen's d = 2.07 ± 0.12 for Moon phases (N = 83 Grade-6 students). About double the effect of a prior version that did not emphasize perspective-taking.
  - Source: [AAS 2016 slides](https://wwtambassadors.org/resource/2016-aas-kissimmee-slidespdf) [S; conference pilot, not peer-reviewed]
  - A ThinkSpace seasons study reported d = 0.54. — [Gordon 2019, Zenodo](https://zenodo.org/records/3758009/files/Gordon_Nicole.pdf) [S]
- **Moon Phases Concept Inventory for Middle School.** *Physical Review Physics Education Research*, 16, 020107 (2020): post-test Cronbach α = 0.786; one "global perspective" item removed for poor psychometrics. — [APS DOI link](https://link.aps.org/doi/10.1103/PhysRevPhysEducRes.16.020107) [S; publisher page returned 403]

### Inferences
- LUNARIS's core features map directly onto what this literature says is hard:
  - The sky chart of Sun and Earth paths over the horizon gives the Earth-based (topocentric) view.
  - The 3D globe lit by the true Sun position gives the space-based view.
  - Explicitly linking the two views is the perspective-taking that ThinkSpace found doubles effect sizes.
- The WWT finding that low-prior-knowledge students struggle with complex 3D supports pairing LUNARIS with a short hands-on lamp-and-ball model first (Engage/Explore). It also supports adding signposting such as "you are here" markers and camera presets. This matches the SRI and Chernikova finding that scaffolding and worked examples help novices.
- LUNARIS goes beyond the usual Moon-phases target. It asks students to reason about illumination at the lunar south pole: low Sun elevation, long shadows, percent-sunlit, and Earth visibility for communications. This is a transfer task that applies the same Sun–Moon–observer geometry to a novel, authentic setting. It is a design strength, but no direct prior study evaluates it.
- Spatial ability is a likely moderator. Measure it at baseline, for example with a short mental-rotation or perspective-taking test, so the pilot can test whether LUNARIS narrows spatial-ability gaps.

### Gaps
- No peer-reviewed study was found that directly compares 3D vs. 2D lunar-phase visualizations with a reported effect size. The WWT 3D-vs-2D comparison exists only in conference papers, and the full text could not be accessed (403).
- Wilhelm, Toland & Cole (2017) appeared in search results: Grade-6 spatial-scientific performance with an LPCI-based measure, where treatment girls scored higher on the "Periodic Patterns" spatial domain. Venue and effect sizes were not verified.
- No study was found on teaching lunar south-pole illumination, polar lighting, or landing-site selection to school students.
- Uttal et al. (2013), "The malleability of spatial skills: A meta-analysis of training studies," *Psychological Bulletin*, 139(2), 352–402, doi:10.1037/a0028446 [PK]. It reports spatial training g ≈ 0.47 and could support the claim that spatial skills are trainable. Not re-verified.
- Lelliott & Rollnick (2010), "Big ideas: A review of astronomy education research 1974–2008," *IJSE*, 32(13), 1771–1799 [PK]. Not re-verified.

---

## Q3. Inquiry-based learning, guidance, and the 5E model (including Thai 5E studies)

### Takeaway
Inquiry-based science teaching has a reliable medium effect on learning (d ≈ 0.50; Furtak et al. 2012), but only when inquiry is guided. Guidance roughly doubles or triples effectiveness compared with unguided inquiry (Lazonder & Harmsen 2016: learning outcomes d = 0.50, performance success d = 0.71). The 5E model has many positive Turkish meta-analyses and wide Thai adoption (IPST). However, no 5E plus simulation plus Moon-phases study for Thai secondary students was found, which is a gap LUNARIS can claim to fill.

### Cited Findings
- **Furtak, Seidel, Iverson & Briggs (2012). Experimental and quasi-experimental studies of inquiry-based science teaching: A meta-analysis. *Review of Educational Research*, 82(3), 300–329.** [V, abstract via secondary]
  - 37 studies (1996–2006). Overall mean effect size 0.50.
  - The epistemic domain (generating, developing and justifying explanations) had the largest effect, 0.75.
  - Studies varying only the social domain had 0.09.
  - Sources: [CU Boulder record](https://experts.colorado.edu/display/pubid_22629); [TIE summary](https://www.tieonline.com/article/396/what-is-it-about-inquiry-)
  - The TIE secondary summary gives teacher-guided inquiry an ES of about 0.60 [S]. The original abstract states teacher-led activities had effect sizes about .40 larger than student-led ones [PK; verify against abstract].
  - A blog critique argues some included effect sizes are implausibly large. This is not peer-reviewed. — [Filling the Pail](https://fillingthepail.substack.com/p/responses-rebuttals-reversals)
- **Lazonder & Harmsen (2016). Meta-analysis of inquiry-based learning: Effects of guidance. *Review of Educational Research*, 86(3), 681–718.** [V via TUM Clearinghouse structured summary]
  - 72 primary studies (1993–2013), students aged 5–22 in STEM. Guided inquiry was compared with unguided inquiry.
  - Learning activities d = 0.66 (k = 20); performance success d = 0.71 (k = 17); learning outcomes d = 0.50 (k = 60).
  - Learning-outcome effects by guidance type: explanations 0.61 (k = 25); status overviews 0.61 (k = 2); prompts 0.55 (k = 8); process constraints 0.52 (k = 4); scaffolds 0.34 (k = 19); heuristics 0.22 (k = 2). Differences between types were not significant.
  - Learning-activity effects: process constraints 0.90, scaffolds 0.77, explanations 0.70. Performance success: explanations 1.45, heuristics 1.17.
  - Effects were larger on inquiry-skill measures (d = 0.78) than on content knowledge (d = 0.37).
  - Age did not moderate the effect, though younger learners may need more specific guidance.
  - Source: [TUM Clearinghouse Kurzreview (German)](https://www.clearinghouse.edu.tum.de/wp-content/uploads/2018/12/CHU_KR-5_Lazonder-Harmsen_2016_Forschendes-Lernen.pdf)
- **Kozcu Çakır & Güven (2019). Effect of 5E learning model on academic achievement and attitude towards the science course: A meta-analysis study. *Çukurova Üniversitesi Eğitim Fakültesi Dergisi*, 48(2), 1111–1140. doi:10.14812/cuefd.544825.** [V, abstract]
  - 38 Turkish science-teaching studies (2006–2016), Cohen's d.
  - 5E had the strongest achievement effect at university level and the weakest at elementary; the strongest by subject was physics. Effect on attitude was moderate.
  - The abstract page does not give pooled d values.
  - Source: [DergiPark](https://dergipark.org.tr/en/pub/cuefd/issue/49528/544825)
- Other 5E meta-analyses (Bahadir & Dikmen, studies 2017–2021; Kaya & Akkuş 2024, acid–base topic g = 1.845) report large positive effects but are mostly built on Turkish theses [S]. — [DergiPark search hits](https://dergipark.org.tr/en/download/article-file/2545814)
- **Thai and regional 5E studies [S]**
  - Malaysian Year-5 study: an AR app ("My Lunar AR") embedded in 5E inquiry for Moon phases gave significantly higher achievement than conventional teaching (primary, not Thai). — [Search hit, journal.unnes.ac.id / redfame](https://www.redfame.com/journal/index.php/jets/article/view/8242/0)
  - Thai ThaiJO studies combine 5E with ICT for Prathom 4 "Moon and solar system" (primary) and for secondary topics such as photosynthesis and polymers. None was found on secondary-level Moon/astronomy simulations. — [ThaiJO examples](https://so01.tci-thaijo.org/index.php/ejChophayom/article/download/269169/175920/1049499); [ThaiJO](https://so03.tci-thaijo.org/index.php/JMND/article/view/283734)
- **Bybee et al. (2006). *The BSCS 5E Instructional Model: Origins and Effectiveness*.** Report for the NIH Office of Science Education [PK]. — [BSCS PDF](https://media.bscs.org/bscsmw/5es/bscs_5e_full_report.pdf) (URL not re-verified)

### Inferences
- Map LUNARIS onto the IPST 5E cycle, building the meta-analytic "active ingredients" into each phase:
  - **Engage:** a mission hook ("Choose a landing site for a Thai lunar rover"). Elicit Moon-phase and "dark side of the Moon" misconceptions with LPCI-style items.
  - **Explore:** guided manipulation of the 3D globe and sky chart, using process constraints (limited controls first) and prompts. These are the largest effects on learning activities in Lazonder & Harmsen.
  - **Explain:** teacher-led explanation plus model-based reasoning with claim–evidence–reasoning (CER). Explanations are the best-supported guidance type for outcomes (d = 0.61), and the epistemic domain has the largest effect in Furtak (0.75).
  - **Elaborate:** transfer to south-pole illumination and multi-site landing trade-offs using real LOLA and SPICE data.
  - **Evaluate:** concept inventory post-test plus a scored decision memo.
- Use the guidance taxonomy (process constraints, status overviews, prompts, heuristics, scaffolds, explanations) explicitly as a design vocabulary in the proposal. Thai education academics will recognize Lazonder & Harmsen as a top-tier source (*Review of Educational Research*).
- Avoid claiming "discovery learning." Unguided discovery underperforms explicit instruction (Alfieri et al. 2011, see Q4 gaps), whereas guided inquiry is the evidence-based variant.

### Gaps
- No Thai secondary study combining 5E, simulation and Moon phases (or lunar science) was found on ThaiJO in this session. A Thai-language search (e.g., "สืบเสาะหาความรู้ 5E ดวงจันทร์", "สถานการณ์จำลอง ดวงจันทร์ มัธยมศึกษา") is recommended.
- Pooled 5E effect sizes from Çakır & Güven (2019) need the full text.
- Bybee et al. (2006) was not re-verified.

---

## Q4. Authentic/real scientific data, mission-framed problem/project-based learning, and cognitive-load considerations

### Takeaway
Authentic research data in classrooms improves students' scientific-explanation skills and data self-efficacy. The best randomized evidence (Data Nuggets, N = 934) shows small but significant effects (d = 0.06–0.22), not dramatic ones. Real data are messy and can overwhelm novices and deter teachers, so authentic data must be paired with scaffolds (CER frameworks, graduated graph support, worked examples). LUNARIS's evidence labels and transparent trade-offs are a strong fit for the PISA 2025 competency of interpreting data and evidence critically.

### Cited Findings
- **Schultheis, Kjelvik, Snowden, Mead & Stuhlsatz (2022). Effects of Data Nuggets on student interest in STEM careers, self-efficacy in data tasks, and ability to construct scientific explanations. *International Journal of Science and Mathematics Education*. doi:10.1007/s10763-022-10295-1.** [V, full text]
  - Design: cluster-randomized controlled efficacy study in US high-school biology. 21 teachers, 44 classrooms, 934 students (treatment 470, comparison 464). Each teacher taught one section with Data Nuggets and one business-as-usual.
  - Overall quantitative reasoning: no significant effect (d = −0.04, p = .48).
  - Constructing scientific explanations (CER component): significant, d = 0.22 (p = .01).
  - Self-efficacy in analysing and interpreting data: d = 0.11 (p = .02). Motivation to pursue a science career: d = 0.06 (p = .02).
  - Interest in data (d = 0.05), value of science (d = 0.04) and engagement (d = 0.01): not significant.
  - Treatment classrooms spent more time engaged in science practices (observation rating M = 1.39 vs. 0.46).
  - Scaffolds were built into the materials: CER structure at three levels, and graphing at three levels (graph provided → axes provided → blank).
  - Source: [NSF PAR full text](https://par.nsf.gov/servlets/purl/10355954)
- **Kjelvik & Schultheis (2019). Getting messy with authentic data: Exploring the potential of using data from scientific research to support student data literacy. *CBE—Life Sciences Education*, 18(2), es2. doi:10.1187/cbe.18-02-0023.**
  - Data literacy develops best when students work with data from real research. Messy real data teaches the nature of science but can also deter teachers. — [CBE-LSE](https://lifescied.org/doi/10.1187/cbe.18-02-0023); [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6755219) [V, abstract]
- An NSF-funded Earth-science project reports that authentic geoscience datasets are underused in K-12 because the data are complex and teachers need sense-making strategies. Its "Data Puzzles" lessons were adopted by hundreds of educators (conference abstract). — [NSF PAR](https://par.nsf.gov/biblio/10112628-getting-messy-authentic-data-exploring-potential-using-data-from-scientific-research-support-student-data-literacy) [S]
- **Scaffolding and prior knowledge with complex material**
  - Chernikova et al. (2020): low-prior-knowledge learners benefit from worked examples; high-prior-knowledge learners from reflection. — [TUM portal](https://portal.fis.tum.de/en/publications/simulation-based-learning-in-higher-education-a-meta-analysis/)
  - D'Angelo et al. (2014): scaffolding modifications g = 0.60. — [SRI](https://www.sri.com/wp-content/uploads/2021/12/simulations-for-stem-learning-executive-summary.pdf)
  - Chernikova et al. (2024): salience of relevant information matters more than authenticity per se. — [TUM portal](https://portal.fis.tum.de/en/publications/where-salience-goes-beyond-authenticity-a-meta-analysis-on-simula/) [S]
- **PISA 2025 alignment.** Science competency 2 is "Construct and evaluate designs for scientific enquiry and interpret scientific data and evidence critically." Competency 3 is "Research, evaluate and use scientific information for decision making and action." — [OECD PISA 2025 Science framework](https://pisa-framework.oecd.org/science-2025/) [V]

### Inferences
- Authentic data should be framed as motivating and good for explanation and argumentation skills, with honest, small expected effect sizes (d ≈ 0.1–0.2 in a large RCT). Thai judges will likely value honesty about realistic magnitudes.
- Cognitive-load design rules for LUNARIS, derived from the cited evidence:
  1. Use progressive disclosure: start with one site and one variable (illumination), then add slope, roughness and Earth visibility.
  2. Provide worked-example walkthroughs, e.g., one fully analysed landing site, before open comparison.
  3. Make relevant information salient: highlight the decisive numbers, and use the evidence labels as signalling cues.
  4. Offer a "Teacher mode" or "Novice mode" with simplified units and Thai-language labels.
  5. Use CER templates for the landing-site recommendation.
- The multi-site trade-off decision (illumination vs. slope vs. Earth visibility) is a natural socio-scientific or engineering decision-making task. It maps onto PISA 2025 competency 3 ("use scientific information for decision making and action") and onto 21st-century skills (critical thinking, collaboration).

### Gaps
- **Project-/problem-based learning meta-analyses** were not verified this session. Candidates to verify:
  - Chen & Yang (2019), "Revisiting the effects of project-based learning on students' academic achievement: A meta-analysis investigating moderators," *Educational Research Review*, 26, 71–81, doi:10.1016/j.edurev.2018.11.001. Reported d ≈ 0.71 [PK].
  - Sadler (2004), "Informal reasoning regarding socioscientific issues: A critical review of research," *JRST*, 41(5), 513–536, doi:10.1002/tea.20009 [PK].
- **Cognitive load and guidance classics** were not re-verified:
  - Kirschner, Sweller & Clark (2006), "Why minimal guidance during instruction does not work," *Educational Psychologist*, 41(2), 75–86, doi:10.1207/s15326985ep4102_1 [PK].
  - Alfieri, Brooks, Aldrich & Tenenbaum (2011), "Does discovery-based instruction enhance learning?" *Journal of Educational Psychology*, 103(1), 1–18, doi:10.1037/a0021017 [PK]. Recalled figures: unassisted discovery vs. explicit instruction d ≈ −0.38; enhanced/guided discovery d ≈ +0.30. Verify before citing.
- No controlled study was found of NASA lunar data (LRO/LOLA, SPICE) used in K-12 classrooms, and no citizen-science meta-analysis was retrieved.
- Engineering-design-challenge meta-analyses (secondary STEM) were not searched for lack of time.

---

## Q5. Theoretical frameworks to cite

### Takeaway
LUNARIS can be anchored in a coherent theory stack:
- constructivism and conceptual change, which motivate the 5E cycle;
- model-based inquiry (students build and test the Sun–Moon–observer model);
- spatial and embodied cognition (frames of reference and perspective-taking);
- Mayer's Cognitive Theory of Multimedia Learning and Cognitive Load Theory (interface and scaffolding design);
- TPACK (teacher integration and professional development);
- the PISA 2025 science framework (competencies and science identity) as the outcome target, with the new Learning in the Digital World domain as further alignment.

Only the PISA 2025 science framework was verified in detail this session; the others are standard citations marked [PK].

### Cited Findings
- **PISA 2025 Science Framework** [V]
  - Three competencies: (1) "Explain phenomena scientifically"; (2) "Construct and evaluate designs for scientific enquiry and interpret scientific data and evidence critically"; (3) "Research, evaluate and use scientific information for decision making and action."
  - Knowledge types: content, procedural and epistemic. Competency 1 includes identifying, constructing and evaluating models, and epistemic knowledge covers the role and limitations of models.
  - Science identity has three dimensions: valuing scientific perspectives and approaches to enquiry; affective elements (science self-concept, self-efficacy, enjoyment, instrumental motivation); and environmental awareness, concern and agency.
  - The framework moves away from "science literacy" as its central concept.
  - Source: [OECD PISA 2025 Science framework site](https://pisa-framework.oecd.org/science-2025/)
  - Other sources: [Utrecht FIsme PDF of the framework](https://www.fisme.science.uu.nl/publicaties/literatuur/PISA_2025_Science_Framework.pdf); [OUP summary](https://sciencecitizens.oup.com/oup-and-pisa/)
- **PISA 2025 Learning in the Digital World (LDW)**: assessed for the first time in PISA 2025 as the innovative domain, with its own competency model in the assessment framework. — [OECD PISA 2025 Assessment and Analytical Framework](https://www.oecd.org/en/publications/pisa-2025-assessment-and-analytical-framework_86c36975-en.html) [S]
- **TPACK**: Mishra, P., & Koehler, M. J. (2006). Technological pedagogical content knowledge: A framework for teacher knowledge. *Teachers College Record*, 108(6), 1017–1054. doi:10.1111/j.1467-9620.2006.00684.x [PK]
- **Cognitive Theory of Multimedia Learning**: Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.). Cambridge University Press. doi:10.1017/9781316941355 [PK]. Relevant principles include signalling, segmenting, pre-training, coherence and spatial contiguity.
- **Model-based inquiry**: Windschitl, M., Thompson, J., & Braaten, M. (2008). Beyond the scientific method: Model-based inquiry as a new paradigm of preference for school science investigations. *Science Education*, 92(5), 941–967. doi:10.1002/sce.20259 [PK]
- **Spatial thinking in astronomy**: Plummer (2014), *Studies in Science Education* (see Q2). — [PDF](https://indico.unina.it/event/73/contributions/1042/attachments/359/649/2014_-_Review_Spatial_Thinking.pdf) [S]
- **Embodied cognition in astronomy simulation**: Lindgren, R., Tscholl, M., Wang, S., & Johnson, E. (2016). Enhancing learning and engagement through embodied interaction within a mixed reality simulation. *Computers & Education*, 95, 174–187. doi:10.1016/j.compedu.2016.01.001 [PK]
- **Chernikova et al. (2024)** on salience vs. authenticity supports applying CTML's signalling principle to authentic-data simulations. — [TUM portal](https://portal.fis.tum.de/en/publications/where-salience-goes-beyond-authenticity-a-meta-analysis-on-simula/) [S]

### Inferences
- Suggested theory-to-feature mapping for the proposal:

| Theory | LUNARIS feature |
|---|---|
| Constructivism / conceptual change | Misconception elicitation in Engage; cognitive conflict ("why is the pole crater dark if the Sun is up?") |
| Model-based inquiry (Windschitl) | Students predict illumination, run the SPICE-lit model, revise their mental model |
| Spatial / embodied cognition (Plummer; Lindgren) | Linked Earth-based sky chart and space-based 3D globe; physical lamp-and-ball and body-rotation activity before the screen |
| CTML / CLT (Mayer; Sweller) | Signalling via evidence labels; segmenting into mission stages; pre-training of vocabulary in Thai; coherence (hide advanced layers) |
| Guided inquiry (Lazonder & Harmsen) | Process constraints, prompts, explanations at each 5E phase |
| TPACK | Teacher guide plus short PD workshop; teacher dashboard |
| PISA 2025 (competencies + science identity) | Outcome measures: explanation, data interpretation, decision-making; identity/self-efficacy survey |

- PISA 2025 science identity (self-efficacy, self-concept, enjoyment, instrumental motivation) offers a ready-made rationale for including an affective outcome measure.

### Gaps
- OECD Learning Compass 2030 (OECD, 2019) was not verified this session; cite from the OECD Education 2030 site after checking.
- LDW competency definitions were not retrieved; check the OECD framework chapter.
- Sweller's Cognitive Load Theory primary citation was not verified. Candidate [PK]: Sweller, van Merriënboer & Paas (2019), "Cognitive architecture and instructional design: 20 years later," *Educational Psychology Review*, 31, 261–292.
- No source was found on IPST's official 5E policy document. The coordinator context states IPST uses 5E; an IPST document should be cited if available.

---

## Q6. Validated assessment instruments (concept inventories, attitude/identity, usability)

### Takeaway
For lunar-geometry learning, the most targeted instrument is the **Lunar Phases Concept Inventory** (LPCI; 20 items, v3 2003; developed with 400+ students). The 2020 middle-school Moon Phases Concept Inventory (α ≈ 0.79) is a closer age match. For broader astronomy, **TOAST** (27 items, α = 0.83, N = 1,104 college) and **ADT 2.0** (21 content items) are college-normed. The **ASSCI** (Sadler et al. 2010) is the only one built for grades 5–12. No validated Thai translations of any of these were found, so the team must translate, back-translate, IOC-validate and pilot. SUS is the standard usability measure; no Thai SUS validation was found.

### Cited Findings
- **LPCI — Lindell, R. S., & Olsen, J. P. (2002). Developing the Lunar Phases Concept Inventory. *Proceedings of the 2002 Physics Education Research Conference*.**
  - Developed from qualitative research on students' mental models of lunar phases. The initial version was tested with more than 400 introductory astronomy students, with reliability, difficulty, concentration and discrimination analyses.
  - Grew from 14 to 19 to 20 items; version 3 was released in 2003.
  - Sources: [PhysPort LPCI](https://www.physport.org/assessments/LPCI); [ComPADRE record](https://www.compadre.org/portal/items/detail.cfm?ID=4323) [S]
  - The LPCI has been used with Grade-6 students in spatial-science research (Wilhelm et al.). — [search summary, PER-Central](https://www.per-central.org/items/PERCFile.cfm?ID=6121) [S]
- **Moon Phases Concept Inventory for Middle School.** *Phys. Rev. Phys. Educ. Res.* 16, 020107 (2020): post-test Cronbach α = 0.786; one item removed. — [APS](https://link.aps.org/doi/10.1103/PhysRevPhysEducRes.16.020107); [DOAJ](https://doaj.org/article/3663e46694c84cdc9e5e1187a3c2f840) [S]
- **TOAST — Slater, S. J. (2014). The development and validation of the Test Of Astronomy STandards (TOAST). *Journal of Astronomy & Earth Sciences Education*.**
  - 27 multiple-choice items; criterion-referenced. Validated through Cronbach α, classical test theory, construct-validity review, sensitivity to instruction and expert review. — [Clute Journals](https://clutejournals.com/index.php/JAESE/article/view/9102) [S]
  - Slater, Price-Schleigh & Stork (2015): item-level analysis with 1,104 participants, Cronbach α = 0.83; each item functioned appropriately. — [Clute Journals](https://clutejournals.com/index.php/JAESE/article/view/9513) [S]; [PhysPort TOAST](https://www.physport.org/assessments/TOAST)
- **ADT 2.0 — Hufnagel, B. (2002). Development of the Astronomy Diagnostic Test. *Astronomy Education Review*, 1(1).**
  - 33 items: 21 content and 12 demographic. Given in 34 astronomy courses with reliability, difficulty and discrimination analyses. — [Hufnagel PDF](https://istardb.org/wp-content/uploads/tainacan-items/1018/20540/Hufnagel_2001_Development-of-the-Astronomy-Diagnostic-Test-1-1.pdf); [PhysPort ADT](https://www.physport.org/assessments/ADT); [Montana State ADT page](https://solar.physics.montana.edu/aae/adt) [S]
  - Follow-up analyses: Deming (2002) and Brogt et al. (2007). — [Brogt et al. PDF](https://istardb.org/wp-content/uploads/tainacan-items/1018/19356/Brogt-et-al.-2007-Analysis-of-the-Astronomy-Diagnostic-Test-1-1.pdf)
- **ASSCI — Sadler, P. M., et al. (2010). The Astronomy and Space Science Concept Inventory: Development and validation of assessment instruments aligned with the K–12 National Science Standards. *Astronomy Education Review*, 8(1).**
  - 211 unique items measuring movement from misconceptions to scientific views. Piloted nationally with 7,599 students and 88 teachers in grades 5–12. — [iSTAR record](https://istardb.org/aerpublications/the-astronomy-and-space-science-concept-inventory-development-and-validation-of-assessment-instruments-aligned-with-the-k-12-national-science-standards/); [PDF](https://indico.unina.it/event/73/contributions/1042/attachments/359/641/2010_-_The_Astronomy_and_Space_Science_Concept_Inventory.pdf) [S]
- **Usability and translation models**
  - Thai Telehealth Usability Questionnaire (T-TUQ): 210 Thai participants; Beaton et al. cross-cultural adaptation; subscale α = 0.83, 0.94, 0.86, 0.83, 0.92. It shows a Thai translation-validation workflow for a usability scale. — [PMC10754239](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10754239/) [S]
  - A Malay SUS validation reported α = .85 (95% CI 0.79–0.91). This is the closest Southeast Asian SUS precedent found. — [JMIR Human Factors 2018](https://humanfactors.jmir.org/2018/2/e10308/PDF) [S]
  - SUS reference: [GMU HRI scale database entry](https://hriscaledatabase.psychology.gmu.edu/usability/2025/01/13/SUS.html) [S]
  - Original SUS: Brooke (1996); 10 items, 5-point; scored 0–100. Bangor, Kortum & Miller (2008), *IJHCI* 24(6), 574–594, doi:10.1080/10447310802205776, reported α ≈ 0.91 [PK]. The commonly cited benchmark mean is about 68 [PK].

### Inferences
- **Recommended assessment battery for a LUNARIS pilot:**
  1. **Concept test.** A Thai-translated subset of LPCI and/or the middle-school MPCI items for Sun–Earth–Moon geometry, plus 8–10 custom items on polar illumination, Earth visibility and slope/landing trade-offs. Validate the custom items with IOC (≥ 0.50) and compute KR-20 on a try-out sample.
  2. **Transfer and decision task.** A CER-scored landing-site recommendation with an analytic rubric. Report inter-rater reliability (Cohen's κ).
  3. **Affective outcomes.** Short scales aligned to PISA 2025 science identity: self-efficacy, enjoyment, instrumental motivation. PISA questionnaire items exist in Thai, because Thailand participates in PISA. That is an inference; the Thai-version items were not verified.
  4. **Usability.** Thai-translated SUS (10 items) with a target SUS ≥ 68, plus teacher TPACK-style implementation feedback.
  5. **Spatial ability covariate.** A short mental-rotation or perspective-taking test.
- Use LPCI or MPCI items as the primary outcome. Do not use TOAST or ADT as the main outcome: they are college-normed and US-standards-aligned, cover broad astronomy, and are less sensitive to a lunar-focused unit.

### Gaps
- LPCI reliability coefficients (KR-20 / α) were not found. They are likely in Lindell's PhD dissertation (2001) or the PERC 2002 paper. Teams must compute their own.
- Original TOAST (2014) α and ASSCI per-form reliabilities were not retrieved.
- ADT 2.0 reliability coefficient was not retrieved.
- No Thai translations of LPCI, TOAST, ADT, ASSCI or SUS were found.
- No validated science-motivation instrument with Thai norms was verified. The Science Motivation Questionnaire II (Glynn et al. 2011, *JRST* 48(10), 1159–1176 [PK]) is a candidate, but a Thai version was not searched.
- The authors of the 2020 middle-school MPCI paper could not be confirmed (publisher page returned 403).

---

## Q7. Recommended research/evaluation design for a small competition pilot (incl. Thai conventions E1/E2 and IOC)

### Takeaway
Thai judges will expect the standard Thai "R&D of educational innovation" sequence:
- expert validation of content and instruments with the IOC index (≥ 0.50);
- efficiency testing of the innovation against an E1/E2 criterion, typically 80/80, through 1:1 → small group → field try-outs;
- an outcome comparison, either pre/post within one group or experimental vs. control.

For international credibility, add Hedges' g with confidence intervals and Hake's normalized gain. Thai papers commonly use the Effectiveness Index (E.I.), which is computed with the same formula as Hake's gain.

### Cited Findings
- **E1/E2 (Thai "media/instructional-package efficiency" criterion)**
  - Associated with Chaiyong Brahmawong (ชัยยงค์ พรหมวงศ์), e.g., "การทดสอบประสิทธิภาพสื่อหรือชุดการสอน" (Developmental testing of media and instructional packages), *Silpakorn Educational Research Journal*, 5(1), 2013. Media and packages must be developmentally tested before use, in a preliminary try-out and then a real try-out. — [Silpakorn PDF](https://old.educ.su.ac.th/2013/images/stories/081957-02.pdf) [S; OCR-garbled snippet, PDF unreachable in this session due to a TLS error]
  - E1 = process efficiency: the mean percentage score on exercises and activities during learning. E2 = product efficiency: the mean percentage score on the post-test.
  - Try-outs proceed one-to-one (1:1), small group (1:10), then field (1:100). — [Silpakorn PDF snippet](https://old.educ.su.ac.th/2013/images/stories/081957-02.pdf); [GotoKnow explainer](https://www.gotoknow.org/posts/486362) [S]
  - Chaiyong reportedly recommends 90/90 or 85/85 for cognitive content and 80/80 or 75/75 for psychomotor/skill content. The OCR text was incomplete, so this needs checking [S].
  - Typical reported results in Thai studies: 80.93/80.83 (English instructional package); E1 = 80.11, E2 = 87.26 (TOEIC video package); 80.67/87.67 (SWU thesis). Each is described as "meeting the 80/80 criterion." — [BRU ELT Journal](https://so14.tci-thaijo.org/index.php/bru_elt_journal/article/view/3175); [SWU IR](https://ir.swu.ac.th/bitstreams/4766a615-8a96-468d-83af-8b34363db085/download) [S]
  - Other Thai papers describing E1/E2 as process vs. outcome efficiency against an 80/80 benchmark: [ACEID 2025 paper](https://papers.iafor.org/wp-content/uploads/papers/aceid2025/ACEID2025_91261.pdf?t=8); [IJIET](https://www.ijiet.org/vol6/737-T0029.pdf) [S]
  - A 2018 Thai methodological article analyses E1/E2: Phachoen Kitrakan (เผชิญ กิจระการ), "การวิเคราะห์ประสิทธิภาพสื่อและเทคโนโลยีเพื่อการศึกษา (E1/E2)," Mahasarakham University. Its full text is image-only and was not readable. — [ThaiJO](https://so02.tci-thaijo.org/index.php/jemmsu/article/view/154690)
  - Recent Thai frameworks separate expert review (internal validity) from E1/E2 efficiency testing (external validity), followed by an effectiveness index and learning-outcome assessment. — [Pankaew et al. 2025, ThaiJO](https://ph01.tci-thaijo.org/index.php/aer/article/download/265241/176295/1087438) [S]
  - Chomeya & Tayraukham (2022) re-examine the concepts of efficiency and effectiveness in the quality of educational innovations. — [J. Education Naresuan Univ.](https://so06.tci-thaijo.org/index.php/edujournal_nu/article/view/248872) [S]
- **IOC (Index of Item–Objective Congruence)**
  - Originates in Rovinelli's 1976 dissertation and Rovinelli & Hambleton (1977), "On the use of content specialists in the assessment of criterion-referenced test item validity," *Dutch Journal of Educational Research*, 2, 49–60.
  - Experts rate each item +1 (clearly measures the objective), 0 (unsure) or −1 (does not measure). The original formula was designed for criterion-referenced tests with several objectives.
  - Thai practice usually simplifies it to the arithmetic mean IOC = ΣR / N.
  - Source: [Tuntavanitch & Jindasri (2018), "The Real Meaning of IOC," *Journal of Educational Measurement, Mahasarakham University*, 24(2)](https://so02.tci-thaijo.org/index.php/jemmsu/article/view/174521) [V, full text read]
  - The procedure adapts Hemphill & Westie (1950). — [Laosinchai, Mahidol](https://il.mahidol.ac.th/jil_systems/index.php/01/article/download/33/6/123) [S]
  - The ≥ 0.50 acceptance cut-off is a Thai applied-research convention, e.g., items with IOC 0.50–1.00 retained and others revised. It is not traceable to the 1977 paper in the sources found. — [ThaiJO LEARN journal example](https://so04.tci-thaijo.org/index.php/LEARN/article/download/102697/82244/259818) [S]

### Inferences
- **Recommended pilot design, feasible for a competition timeline:**
  1. **Phase 1, development and expert validation.** 3–5 experts (astronomy/physics, science education, educational technology/measurement, and an in-service IPST-trained teacher). They rate:
     - lesson plans and LUNARIS activities for appropriateness (5-point Likert, mean ≥ 3.51 = "high" is a common Thai convention [PK]);
     - test items for IOC ≥ 0.50.
     Then try out the test on a non-sample class (n ≈ 30–40) for difficulty p (0.20–0.80), discrimination r (≥ 0.20), and KR-20 reliability (≥ 0.70).
  2. **Phase 2, efficiency testing (E1/E2).** Run 1:1 (3 students: weak/average/strong), then 1:10 (small group), then a field class (about 30–40). Report E1/E2 against an 80/80 criterion, where E1 is from in-lesson mission worksheets and E2 is from the post-test.
  3. **Phase 3, effectiveness.** Ideally a quasi-experimental design: an intact LUNARIS + 5E class vs. a comparison 5E class taught with standard IPST materials (textbook plus physical model), with pre-test as covariate (ANCOVA). Report:
     - Hedges' g with 95% CI;
     - Hake's normalized gain ⟨g⟩ = (post% − pre%)/(100 − pre%), where < 0.3 is low, 0.3–0.7 medium, > 0.7 high;
     - the Thai E.I., which uses the same formula, with E.I. ≥ 0.50 as the usual Thai target [PK];
     - affective and SUS outcomes;
     - qualitative evidence: student CER memos and teacher interviews (TPACK lens).
     If no control class is possible, use a one-group pre/post with a paired t-test plus normalized gain, and acknowledge the threats to internal validity.
- **Sample size (standard power calculation, α = .05, power = .80):**
  - Two independent groups detecting d = 0.50: about 64 per group, i.e., about two classes per arm.
  - One-group pre/post detecting d_z = 0.50: about 34 students.
- **Interpreting effect sizes for judges:**
  - Small pilots with researcher-made tests typically inflate effect sizes. The SRI meta-analysis's g ≈ 0.6 is a realistic benchmark.
  - Large-scale RCTs (Data Nuggets) show d ≈ 0.1–0.2.
  - Framing pilot results against these benchmarks will read as rigorous rather than over-claiming.
- **E1/E2 is a Thai convention** with no direct equivalent in international literature. Present it alongside, not instead of, effect sizes. Note that E1 depends heavily on how the in-lesson tasks are scored. Inference: the international literature uses formative-assessment and implementation-fidelity measures in its place.

### Gaps
- Not verified this session [PK]:
  - Hake, R. R. (1998), "Interactive-engagement versus traditional methods: A six-thousand-student survey of mechanics test data for introductory physics courses," *American Journal of Physics*, 66(1), 64–74, doi:10.1119/1.18809. Normalized gain bands (low < 0.3, medium 0.3–0.7, high > 0.7); interactive engagement averaged about 0.48 vs. 0.23 for traditional.
  - The E.I. formula (Goodman, Fletcher & Schneider, 1980) and the Thai ≥ 0.50 E.I. criterion.
  - Effect-size benchmarks: Kraft (2020), "Interpreting effect sizes of education interventions," *Educational Researcher*, 49(4), 241–253, doi:10.3102/0013189X20912798; Cheung & Slavin (2016), "How methodological features affect effect sizes in education," *Educational Researcher*, 45(5), 283–292, doi:10.3102/0013189X16656615.
  - Rovinelli & Hambleton (1977) volume and pages are as quoted in Tuntavanitch & Jindasri (2018). The original was not retrievable from Thailand per those authors, and not accessed here.
- Chaiyong's exact 80/80 rationale and the reported ±2.5% tolerance rule could not be confirmed (Silpakorn PDF unreachable). The ±2.5% tolerance is recalled from prior knowledge only.
- No published critique of E1/E2 in an international journal was found. Chomeya & Tayraukham (2022) may contain Thai-language critique, but its content was not read.
- The Thai Likert interpretation bands (e.g., 4.51–5.00 = highest) are a common convention but no source was verified here.
