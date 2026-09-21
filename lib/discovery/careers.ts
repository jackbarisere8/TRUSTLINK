export type CareerCategory =
  | "Technology"
  | "Skilled Trades"
  | "Creative & Media"
  | "Business & Finance"
  | "Engineering & Energy"
  | "Healthcare & Wellness"
  | "Agriculture & Processing";

export type TrendStatus = "Emerging" | "Established" | "Evolving";

export type TrendCategory =
  | "CURRENT_OPPORTUNITY_DEMAND"
  | "EMERGING_SKILL_SIGNAL"
  | "REGULATORY_INFRASTRUCTURE_PUSH";

export interface TrendSignal {
  id: string;
  signalType: TrendCategory;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl?: string;
  sourceDate: string;
  observedAt: string;
  geography: string;
  confidence: "HIGH" | "MEDIUM" | "EMERGING";
  slug: string;
}

export interface CareerTrendSignal {
  summary: string;
  source: string;
  date: string;
  signalType?: TrendCategory;
  geography?: string;
  confidence?: "HIGH" | "MEDIUM" | "EMERGING";
}

export interface Career {
  id: string;
  slug: string;
  title: string;
  category: CareerCategory;
  tagline: string;
  description: string;
  workdayTasks: string[];
  technicalSkills: string[];
  softSkills: string[];
  entryRoutes: {
    title: string;
    description: string;
    typicalDuration: string;
  }[];
  toolsRequired: string[];
  typicalEmployers: string[];
  relatedCareers: string[];
  typicalIncomeRange: string;
  trendStatus: TrendStatus;
  trendSignal: CareerTrendSignal;
  suitableForMinors: boolean;
}

export const CAREER_TAXONOMY: Career[] = [
  // ── Technology ─────────────────────────────────────────────────────────────
  {
    id: "car_01",
    slug: "network-technician",
    title: "Network Technician",
    category: "Technology",
    tagline: "Install, configure, and maintain physical and wireless computer networks.",
    description:
      "Network Technicians are the backbone of Nigeria's digital infrastructure. They run structured cabling, configure routers and switches, set up enterprise Wi-Fi, troubleshoot internet outages, and ensure offices, schools, and homes stay connected.",
    workdayTasks: [
      "Terminating and testing Cat6/Cat6A Ethernet cables and fiber-optic drops",
      "Configuring routers, switches, and access points for small to medium enterprises",
      "Diagnosing network latency, packet loss, and hardware faults",
      "Documenting IP address schemes and network topology diagrams",
      "Performing on-site maintenance at client offices and data cabinets",
    ],
    technicalSkills: [
      "TCP/IP Networking",
      "Subnetting & IP Addressing",
      "Router & Switch Configuration",
      "Structured Cabling (Punchdown, Crimping)",
      "Wi-Fi Site Surveys & Optimization",
    ],
    softSkills: [
      "Methodical troubleshooting",
      "Patience under client pressure",
      "Clear verbal communication",
      "Physical agility for installations",
    ],
    entryRoutes: [
      {
        title: "Vocational & Practical Apprenticeship",
        description: "6 to 12 months working alongside an ISP field contractor or enterprise IT installer.",
        typicalDuration: "6–12 months",
      },
      {
        title: "Professional Certification",
        description: "Self-study or bootcamp for CompTIA Network+ or Cisco CCNA.",
        typicalDuration: "3–6 months",
      },
      {
        title: "Polytechnic / University Diploma",
        description: "OND/HND or BSc in Computer Science or Electrical/Electronics Engineering.",
        typicalDuration: "2–4 years",
      },
    ],
    toolsRequired: [
      "RJ45 Crimping Tool & Cable Stripper",
      "Network Cable Tester & Tone Probe",
      "Field Technician Laptop with Ethernet Port",
      "Console Cable (USB to RJ45)",
      "Screwdriver set & punchdown tool",
    ],
    typicalEmployers: [
      "Internet Service Providers (Spectranet, Smile, FibreOne, ipNX)",
      "Commercial Banks & Fintech Offices",
      "Independent IT Support Contractors",
      "Educational Institutions & Hospitals",
    ],
    relatedCareers: [
      "Network Engineer",
      "Systems Administrator",
      "Cybersecurity Analyst",
      "Fiber Optic Splicer",
    ],
    typicalIncomeRange: "₦120,000 – ₦450,000 / month",
    trendStatus: "Established",
    trendSignal: {
      summary: "Broadband expansion across major Nigerian commercial hubs sustains continuous demand for field deployment technicians.",
      source: "Nigerian Communications Commission / Industry Reports",
      date: "Q1 2026",
    },
    suitableForMinors: true,
  },
  {
    id: "car_02",
    slug: "ui-ux-designer",
    title: "UI/UX Designer",
    category: "Creative & Media",
    tagline: "Design clear, intuitive user experiences for mobile apps and web platforms.",
    description:
      "UI/UX Designers solve problems for users by turning complex product requirements into clean visual interfaces and effortless digital workflows. They conduct user research, create wireframes, test prototypes, and craft final design systems in Figma.",
    workdayTasks: [
      "Interviewing Nigerian users to uncover pain points in digital apps",
      "Designing responsive mobile-first layouts and components in Figma",
      "Building clickable interactive prototypes for client stakeholder review",
      "Creating accessible color palettes and typography hierarchies",
      "Handing off design tokens and assets cleanly to frontend developers",
    ],
    technicalSkills: [
      "Figma & Component Auto-Layout",
      "Design Systems & Token Architecture",
      "User Research & Usability Testing",
      "Wireframing & Information Architecture",
      "Mobile Interaction Design (iOS & Android)",
    ],
    softSkills: [
      "Deep user empathy",
      "Structured visual thinking",
      "Giving and receiving constructive critique",
      "Stakeholder presentation",
    ],
    entryRoutes: [
      {
        title: "Self-Directed Portfolio & Case Studies",
        description: "Learn Figma online, redesign 3 real Nigerian apps, document problem-solving process.",
        typicalDuration: "4–8 months",
      },
      {
        title: "Intensive Product Design Bootcamp",
        description: "Structured cohort program with peer feedback and real client briefs.",
        typicalDuration: "12–16 weeks",
      },
      {
        title: "Graphic Design Transition",
        description: "Expanding graphic design expertise into interaction design and product thinking.",
        typicalDuration: "3–6 months",
      },
    ],
    toolsRequired: [
      "Modern laptop (8GB+ RAM recommended)",
      "Figma (Free or Professional tier)",
      "Screen recording tool (Loom) for walkthroughs",
      "Pen & Paper for rapid sketching",
    ],
    typicalEmployers: [
      "Fintech startups & product studios (Lagos, remote)",
      "Digital agencies & software houses",
      "Independent freelance practice via TrustLink",
      "Foreign remote teams",
    ],
    relatedCareers: [
      "Product Manager",
      "Frontend Developer",
      "Brand Designer",
      "Design Systems Lead",
    ],
    typicalIncomeRange: "₦180,000 – ₦750,000+ / month",
    trendStatus: "Evolving",
    trendSignal: {
      summary: "AI prototyping tools are speeding up asset production, shifting designer value toward user insight and system architecture.",
      source: "TechCabal African Tech Talent Survey",
      date: "2026",
    },
    suitableForMinors: true,
  },
  {
    id: "car_03",
    slug: "software-engineer",
    title: "Software Engineer",
    category: "Technology",
    tagline: "Build reliable web, mobile, and backend systems powering modern services.",
    description:
      "Software Engineers write, test, and maintain code that turns business logic into functional applications. In Nigeria, engineers power payment rails, logistics tracking, USSD banking interfaces, e-commerce storefronts, and internal enterprise software.",
    workdayTasks: [
      "Writing clean, maintainable code in TypeScript, Python, Go, or Java",
      "Designing relational database schemas and REST/GraphQL APIs",
      "Debugging production errors and diagnosing slow queries",
      "Reviewing pull requests from peers and writing unit tests",
      "Deploying updates to cloud infrastructure and monitoring logs",
    ],
    technicalSkills: [
      "JavaScript / TypeScript & Modern Frameworks",
      "Relational Databases (PostgreSQL / MySQL)",
      "API Design & Server Architecture",
      "Git Version Control & Code Collaboration",
      "Cloud Deployment & Server Management",
    ],
    softSkills: [
      "Logical decomposition of hard problems",
      "Continuous self-learning",
      "Technical writing and documentation",
      "Collaboration across teams",
    ],
    entryRoutes: [
      {
        title: "Self-Taught with Shipped Projects",
        description: "Build 3 full-stack applications solving real problems with public code on GitHub.",
        typicalDuration: "6–12 months",
      },
      {
        title: "University / Polytechnic Degree",
        description: "BSc or HND in Computer Science, Software Engineering, or Computer Engineering.",
        typicalDuration: "4–5 years",
      },
      {
        title: "Internship / Apprenticeship Placement",
        description: "Junior developer role under experienced senior engineers.",
        typicalDuration: "6–12 months",
      },
    ],
    toolsRequired: [
      "Capable laptop (16GB RAM recommended for local builds)",
      "VS Code or WebStorm IDE",
      "Git & GitHub account",
      "Reliable internet connection",
    ],
    typicalEmployers: [
      "Nigerian banks and fintechs (Interswitch, Paystack, Flutterwave, Moniepoint)",
      "E-commerce, logistics, and healthcare companies",
      "Independent contractors and tech consultancies",
      "Global remote companies",
    ],
    relatedCareers: [
      "DevOps / Cloud Engineer",
      "Data Engineer",
      "Cybersecurity Engineer",
      "Technical Product Lead",
    ],
    typicalIncomeRange: "₦250,000 – ₦1,500,000+ / month",
    trendStatus: "Evolving",
    trendSignal: {
      summary: "Editorial observation: backend engineering and developer tools are possible areas to explore. This pilot has no validated demand estimate.",
      source: "NISER Labour Market Analysis",
      date: "Q1 2026",
    },
    suitableForMinors: true,
  },

  // ── Skilled Trades (First-Class Technical Vocations) ────────────────────────
  {
    id: "car_04",
    slug: "solar-energy-technician",
    title: "Solar Energy & Inverter Technician",
    category: "Engineering & Energy",
    tagline: "Design, size, install, and service renewable solar and inverter power systems.",
    description:
      "With Nigeria's persistent grid power constraints and rising fuel costs, Solar Technicians represent one of the fastest-growing technical trades in the country. They calculate electrical load requirements, install photovoltaic panels, wire hybrid inverters, and configure lithium battery banks for residential and commercial clients.",
    workdayTasks: [
      "Conducting load audits to determine power consumption of homes and businesses",
      "Mounting solar panels securely on rooftops with proper tilt and waterproofing",
      "Wiring DC combiners, charge controllers, hybrid inverters, and battery banks",
      "Testing earthing, surge protection, and circuit breakers for electrical safety",
      "Troubleshooting inverter error codes and performing battery health tests",
    ],
    technicalSkills: [
      "Electrical Load Calculation & Sizing",
      "DC & AC Electrical Wiring",
      "Inverter & Battery Bank Configuration",
      "Rooftop Mounting & Safety Standards",
      "Multimeter & Clamp Meter Diagnostics",
    ],
    softSkills: [
      "Physical fitness and comfort with heights",
      "Meticulous electrical safety awareness",
      "Honest customer pricing and transparency",
      "Job completion reliability",
    ],
    entryRoutes: [
      {
        title: "Hands-on Artisan Apprenticeship",
        description: "Mentorship under an established solar installer on live installations.",
        typicalDuration: "6–12 months",
      },
      {
        title: "FME TVET / Technical College Training",
        description: "Accredited technical course in Renewable Energy / Solar Installation.",
        typicalDuration: "3–6 months",
      },
      {
        title: "Electrical Installation Transition",
        description: "Electricians adding solar and lithium battery modules to their practice.",
        typicalDuration: "2–4 months",
      },
    ],
    toolsRequired: [
      "Digital Multimeter & AC/DC Clamp Meter",
      "Insulated Electrician Screwdriver Set & Wire Stripper",
      "Heavy-Duty Battery Cable Crimper",
      "Cordless Hammer Drill with masonry & metal bits",
      "Full Body Safety Harness for roof installations",
    ],
    typicalEmployers: [
      "Commercial Solar EPC Firms (Renewsys, Starsight, Daystar, Arnergy)",
      "Telecom Tower Operators & Infrastructure Maintenance Firms",
      "Self-Employed Solar Contractors with TrustLink Agreements",
      "Estate Facilities Management Companies",
    ],
    relatedCareers: [
      "Electrical Installation Specialist",
      "Energy Storage Engineer",
      "Facilities Maintenance Manager",
      "High-Voltage Substation Technician",
    ],
    typicalIncomeRange: "₦150,000 – ₦800,000+ / project / month",
    trendStatus: "Emerging",
    trendSignal: {
      summary: "Removal of fuel subsidies and grid unreliability have triggered unprecedented national adoption of decentralized solar systems.",
      source: "Rural Electrification Agency (REA) / NISER 2026",
      date: "Q1 2026",
    },
    suitableForMinors: false, // Involves high-voltage wiring and working at heights
  },
  {
    id: "car_05",
    slug: "electrical-installation-artisan",
    title: "Electrical Installation Specialist",
    category: "Skilled Trades",
    tagline: "Install, wire, test, and protect electrical distribution systems in buildings.",
    description:
      "Electrical Installation Specialists wire residential houses, commercial complexes, and industrial warehouses. They lay conduits, pull cables, assemble distribution boards with RCD/MCB protection, install lighting systems, and verify grounding resistance.",
    workdayTasks: [
      "Reading architectural electrical conduit drawings and floor plans",
      "Chasing walls and laying PVC/GI conduits before plastering",
      "Wiring 3-phase and single-phase distribution boards with proper load balancing",
      "Installing sockets, switches, decorative lighting, and changeover switches",
      "Earthing testing using earth resistance testers to meet safety standards",
    ],
    technicalSkills: [
      "Conduit Layout & Cable Sizing",
      "Distribution Board (DB) Assembly & Balancing",
      "Earthing & Lightning Protection",
      "Fault Finding with Continuity & Insulation Testers",
      "Single-Phase & 3-Phase Wiring Standards",
    ],
    softSkills: [
      "Extreme precision with safety standards",
      "Punctuality on construction site timelines",
      "Clear coordination with masons and plasterers",
      "Material estimating accuracy",
    ],
    entryRoutes: [
      {
        title: "Traditional Master Artisan Apprenticeship",
        description: "Working under a master electrician across residential building projects.",
        typicalDuration: "1–2 years",
      },
      {
        title: "FME TVET & Technical College Certificate",
        description: "National Technical Certificate (NTC) in Electrical Installation from NABTEB.",
        typicalDuration: "1–3 years",
      },
    ],
    toolsRequired: [
      "Insulated hand tool kit (pliers, cutters, screwdrivers 1000V)",
      "Digital Multimeter & Continuity Tester",
      "Conduit bender and fish tape / wire puller",
      "Chasing machine or hammer & cold chisel",
    ],
    typicalEmployers: [
      "Building Construction Contractors & Developers",
      "Estate Facilities Management Teams",
      "Independent Licensed Electrician Practice with TrustLink",
      "Manufacturing Plants & Hotels",
    ],
    relatedCareers: [
      "Solar & Inverter Technician",
      "Industrial Automation Technician",
      "Building Services Engineer",
    ],
    typicalIncomeRange: "₦120,000 – ₦600,000 / month",
    trendStatus: "Established",
    trendSignal: {
      summary: "Steady urban construction across Lagos, Abuja, Ibadan, Port Harcourt, and Kano maintains consistent baseline demand.",
      source: "Federal Ministry of Works / Construction Labour Index",
      date: "2026",
    },
    suitableForMinors: false,
  },
  {
    id: "car_06",
    slug: "automotive-diagnostics-technician",
    title: "Automotive Diagnostics Technician",
    category: "Skilled Trades",
    tagline: "Diagnose and repair electronic control units, sensors, and mechanical systems in modern vehicles.",
    description:
      "Automotive Diagnostics Technicians represent the modern evolution of vehicle repair in Nigeria. Moving far beyond traditional guesswork, they connect OBD-II diagnostic scanners to interrogate Electronic Control Modules (ECMs), test sensor waveforms, diagnose transmission control faults, and troubleshoot hybrid battery packs.",
    workdayTasks: [
      "Connecting diagnostic scan tools to vehicle OBD ports to retrieve diagnostic trouble codes (DTCs)",
      "Interpreting live sensor data streams (O2 sensors, MAF, fuel trims) with oscilloscopes",
      "Reprogramming or flashing vehicle ECUs and key immobilizers",
      "Diagnosing ABS, airbag, power steering, and electronic suspension faults",
      "Explaining technical fault reports and required replacement parts to vehicle owners",
    ],
    technicalSkills: [
      "OBD-II Diagnostic Scanning & Data Interpretation",
      "Automotive Electrical Schematics Reading",
      "ECU Coding & Immobilizer Programming",
      "Oscilloscope Waveform Diagnostics",
      "Sensor Testing (Hall effect, Reluctance, Piezo)",
    ],
    softSkills: [
      "Analytical diagnostic problem-solving",
      "Honesty regarding necessary vs unnecessary repairs",
      "Clear explanation of complex automotive electronics",
      "Clean workplace discipline",
    ],
    entryRoutes: [
      {
        title: "Modern Automotive Apprenticeship",
        description: "Training in a diagnostic-equipped auto garage under an experienced technician.",
        typicalDuration: "1–2 years",
      },
      {
        title: "Technical Institute Mechatronics Diploma",
        description: "Diploma in Automotive Mechatronics from accredited technical colleges.",
        typicalDuration: "1–2 years",
      },
    ],
    toolsRequired: [
      "Professional Bidirectional Scan Tool (Autel, Launch, or Topdon)",
      "Automotive Digital Multimeter & Logic Probe",
      "Automotive 2-channel Oscilloscope",
      "Insulated socket and ratchet tool chest",
    ],
    typicalEmployers: [
      "Modern Automotive Service Centers & Dealerships",
      "Fleet Management & Logistics Companies (GIG, Sendbox, Uber fleets)",
      "Independent Mobile Auto Diagnostics Contractors",
    ],
    relatedCareers: [
      "EV & Hybrid Vehicle Technician",
      "Diesel Fuel Injection Specialist",
      "Heavy Duty Plant Mechanic",
    ],
    typicalIncomeRange: "₦150,000 – ₦700,000+ / month",
    trendStatus: "Evolving",
    trendSignal: {
      summary: "The shift of the Nigerian vehicle fleet to computerized and hybrid vehicles has made traditional mechanics obsolete without electronic diagnostic skills.",
      source: "Nigerian Automotive Industry Development Plan",
      date: "2026",
    },
    suitableForMinors: false,
  },
  {
    id: "car_07",
    slug: "fashion-designer-apparel-maker",
    title: "Fashion Designer & Bespoke Apparel Maker",
    category: "Creative & Media",
    tagline: "Design, pattern-cut, construct, and finish bespoke traditional and contemporary garments.",
    description:
      "Fashion Designers and Bespoke Tailors in Nigeria are central to the cultural and creative economy. They turn client measurements and fabric (Aso-Oke, Ankara, Cashmere, Wool) into bespoke ceremonial attire, corporate clothing, and ready-to-wear collections.",
    workdayTasks: [
      "Taking precise anatomical measurements and consulting on silhouette styling",
      "Drafting patterns on paper or digital CAD software with seam allowances",
      "Cutting fabric efficiently to minimize textile waste and pattern mismatch",
      "Assembling garments on industrial straight-stitch, overlock, and embroidery machines",
      "Conducting fitting sessions and performing precise alterations",
    ],
    technicalSkills: [
      "Precision Body Measurement",
      "Flat Pattern Drafting & Draping",
      "Industrial Sewing Machine Operation",
      "Textile Identification & Grainline Handling",
      "Garment Finishing & Ironing Pressing Techniques",
    ],
    softSkills: [
      "Strict deadline discipline (especially for event dates)",
      "Attention to micro-details and symmetry",
      "Client communication and expectations management",
      "Creative color and styling advice",
    ],
    entryRoutes: [
      {
        title: "Apprenticeship in Established Fashion Atelier",
        description: "Hands-on cutting and sewing under a bespoke tailoring director.",
        typicalDuration: "9–18 months",
      },
      {
        title: "Fashion Academy Diploma",
        description: "Structured design curriculum covering illustration, pattern drafting, and finishing.",
        typicalDuration: "6–12 months",
      },
    ],
    toolsRequired: [
      "Industrial Straight-Stitch Machine (Juki / Brother / Two-Tiger)",
      "Industrial Overlock / Weaving Machine",
      "Heavy-duty Steam Press Iron",
      "Pattern drafting rulers (French curve, hip curve, L-square) & shears",
    ],
    typicalEmployers: [
      "Bespoke Fashion Houses & Ateliers (Lagos, Abuja, Port Harcourt, Ibadan)",
      "Garment Manufacturing & Ready-to-Wear Brands",
      "Independent Designer Practice with TrustLink Agreements",
    ],
    relatedCareers: [
      "Costume Designer",
      "Textile Designer",
      "Fashion Brand Manager",
      "Pattern Maker",
    ],
    typicalIncomeRange: "₦150,000 – ₦1,000,000+ / month",
    trendStatus: "Established",
    trendSignal: {
      summary: "Vibrant Nigerian ceremonial culture and expanding exports of African apparel sustain consistent demand for high-craft bespoke garment makers.",
      source: "Bank of Industry Creative Sector Report",
      date: "2026",
    },
    suitableForMinors: true,
  },
  {
    id: "car_08",
    slug: "cybersecurity-analyst",
    title: "Cybersecurity Analyst",
    category: "Technology",
    tagline: "Protect enterprise networks, user data, and financial systems from digital threats.",
    description:
      "Cybersecurity Analysts defend organizations against malware, phishing, unauthorized intrusions, and data leaks. They monitor security operations centers (SOC), configure firewalls, conduct vulnerability assessments, and enforce compliance with data protection standards like NDPR.",
    workdayTasks: [
      "Monitoring security event logs in SIEM tools for suspicious activity",
      "Running vulnerability scans across servers, APIs, and cloud buckets",
      "Investigating suspected phishing emails and credential theft attempts",
      "Configuring endpoint protection, multi-factor authentication, and firewall policies",
      "Drafting incident response reports and security advisory memos",
    ],
    technicalSkills: [
      "Network Protocols & Packet Analysis (Wireshark)",
      "SIEM Log Analysis (Splunk, Elastic, Wazuh)",
      "Vulnerability Scanning (Nessus, Nmap)",
      "Operating System Hardening (Linux & Windows)",
      "Knowledge of Nigeria Data Protection Act (NDPA)",
    ],
    softSkills: [
      "High integrity and ethical responsibility",
      "Relentless curiosity and investigative persistence",
      "Calm crisis communication",
      "Discretion with sensitive corporate data",
    ],
    entryRoutes: [
      {
        title: "IT Support / Networking Transition",
        description: "Progress from network or helpdesk roles by obtaining Security+ / CySA+ certifications.",
        typicalDuration: "6–12 months",
      },
      {
        title: "Cybersecurity Degree / Diploma",
        description: "BSc in Cybersecurity or Computer Science with hands-on lab projects.",
        typicalDuration: "4 years",
      },
      {
        title: "Hands-on Security Labs & CTFs",
        description: "Documented achievements on TryHackMe, HackTheBox, and practical defense blueprints.",
        typicalDuration: "6–12 months",
      },
    ],
    toolsRequired: [
      "Capable laptop running Linux/Virtual Machines",
      "Packet Analyzer (Wireshark)",
      "Vulnerability Scanners (OpenVAS, Nmap)",
      "Terminal & Scripting environment (Bash / Python)",
    ],
    typicalEmployers: [
      "Commercial Banks & Payment Switches",
      "Telecommunications Firms",
      "Managed Security Service Providers (MSSPs)",
      "Government & Defense Agencies",
    ],
    relatedCareers: [
      "Penetration Tester / Ethical Hacker",
      "Security Operations Center (SOC) Manager",
      "Information Security Auditor",
    ],
    typicalIncomeRange: "₦300,000 – ₦1,800,000+ / month",
    trendStatus: "Emerging",
    trendSignal: {
      summary: "Editorial observation: digital services use information-security skills. This pilot does not measure demand or confirm professional certification.",
      source: "Nigeria Data Protection Commission (NDPC) Annual Report",
      date: "2026",
    },
    suitableForMinors: true,
  },
];
