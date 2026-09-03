/**
 * Seeds the database.
 *
 *   npm run seed
 *
 * Idempotent: re-running updates existing records instead of duplicating them.
 * Staff e-mails come from the environment when provided, otherwise placeholders
 * are used and printed at the end so they can be replaced later.
 */
import { connectDB, disconnectDB } from "../src/lib/db/mongoose";
import {
  Announcement,
  Complaint,
  ComplaintEvent,
  Counter,
  User,
  Worker,
} from "../src/models";
import { ensureSettings } from "../src/lib/services/settings";
import { hashPassword } from "../src/lib/auth/password";
import { env } from "../src/lib/config/env";
import { computeSlaDueDates } from "../src/lib/domain/sla";
import { computePriorityScore } from "../src/lib/domain/priority";
import { nextComplaintCode } from "../src/lib/services/complaintCode";
import {
  DEFAULT_SETTINGS,
  HOSTEL_META,
  type Category,
  type Hostel,
  type Severity,
} from "../src/lib/domain/constants";

const password = env.seedPassword;

type StaffSpec = {
  key: string;
  role: "RT" | "WARDEN" | "COORDINATOR";
  name: string;
  email: string;
  hostel?: Hostel;
};

const staff: StaffSpec[] = [
  {
    key: "RT_GIRLS",
    role: "RT",
    name: process.env.SEED_RT_GIRLS_NAME ?? "RT — Girls Hostel",
    email: process.env.SEED_RT_GIRLS_EMAIL ?? "rt.girls@example.edu",
    hostel: "GIRLS",
  },
  {
    key: "RT_QASIM",
    role: "RT",
    name: process.env.SEED_RT_QASIM_NAME ?? "RT — Qasim Hostel",
    email: process.env.SEED_RT_QASIM_EMAIL ?? "rt.qasim@example.edu",
    hostel: "QASIM",
  },
  {
    key: "RT_FATIMA",
    role: "RT",
    name: process.env.SEED_RT_FATIMA_NAME ?? "RT — Fatima Hostel",
    email: process.env.SEED_RT_FATIMA_EMAIL ?? "rt.fatima@example.edu",
    hostel: "FATIMA",
  },
  {
    key: "WARDEN",
    role: "WARDEN",
    name: process.env.SEED_WARDEN_NAME ?? "Hostel Warden",
    email: process.env.SEED_WARDEN_EMAIL ?? "warden@example.edu",
  },
  {
    key: "COORDINATOR",
    role: "COORDINATOR",
    name: process.env.SEED_COORDINATOR_NAME ?? "Campus Coordinator",
    email: process.env.SEED_COORDINATOR_EMAIL ?? "coordinator@example.edu",
  },
];

const workers = [
  { name: "Ashraf Ali", trade: "ELECTRICIAN" as const, phone: "0300-1234567", hostels: ["GIRLS", "QASIM", "FATIMA"] as Hostel[] },
  { name: "Muhammad Yousaf", trade: "PLUMBER" as const, phone: "0301-2345678", hostels: ["GIRLS", "QASIM", "FATIMA"] as Hostel[] },
  { name: "Riaz Masih", trade: "CARPENTER" as const, phone: "0302-3456789", hostels: ["QASIM"] as Hostel[] },
  { name: "Saima Bibi", trade: "CLEANER" as const, phone: "0303-4567890", hostels: ["GIRLS", "FATIMA"] as Hostel[] },
  { name: "Bilal Ahmed", trade: "IT_NETWORK" as const, phone: "0304-5678901", hostels: ["GIRLS", "QASIM", "FATIMA"] as Hostel[] },
  { name: "Naveed Iqbal", trade: "AC_TECHNICIAN" as const, phone: "0305-6789012", hostels: ["QASIM", "FATIMA"] as Hostel[] },
  { name: "Ghulam Nabi", trade: "MASON" as const, phone: "0306-7890123", hostels: ["GIRLS", "QASIM", "FATIMA"] as Hostel[] },
];

const demoStudents = [
  { name: "Ayesha Khan", regNo: "2023-CS-580", email: "ayesha.demo@example.edu", hostel: "FATIMA" as Hostel, roomNo: "F-214" },
  { name: "Hira Sadiq", regNo: "2022-SE-114", email: "hira.demo@example.edu", hostel: "GIRLS" as Hostel, roomNo: "G-108" },
  { name: "Usman Tariq", regNo: "2023-EE-77", email: "usman.demo@example.edu", hostel: "QASIM" as Hostel, roomNo: "Q-311" },
  { name: "Bilal Nawaz", regNo: "2021-ME-9", email: "bilal.demo@example.edu", hostel: "QASIM" as Hostel, roomNo: "Q-105" },
];

const demoComplaints: {
  studentIndex: number;
  category: Category;
  title: string;
  description: string;
  severity: Severity;
  location: string;
  hoursAgo: number;
}[] = [
  {
    studentIndex: 0,
    category: "ELECTRICITY",
    title: "No electricity in room since last night",
    description:
      "The power in room F-214 has been out since about 11 pm yesterday. The main switch trips immediately when we turn it back on. There is a burning smell near the socket beside the study table.",
    severity: "CRITICAL",
    location: "Room F-214, near the study table socket",
    hoursAgo: 30,
  },
  {
    studentIndex: 0,
    category: "PLUMBING_WATER",
    title: "Washroom tap leaking continuously",
    description:
      "The tap in the second-floor common washroom has been leaking for three days. A lot of water is being wasted and the floor stays wet and slippery.",
    severity: "MEDIUM",
    location: "Second floor common washroom",
    hoursAgo: 74,
  },
  {
    studentIndex: 1,
    category: "INTERNET_WIFI",
    title: "Wi-Fi not reachable in G block rooms",
    description:
      "There is no Wi-Fi signal in rooms G-105 to G-112. We have to sit in the corridor to attend online classes. This started after the router was moved last week.",
    severity: "HIGH",
    location: "G block, rooms 105-112",
    hoursAgo: 50,
  },
  {
    studentIndex: 2,
    category: "AC_HEATING_FAN",
    title: "Ceiling fan making loud noise and wobbling",
    description:
      "The ceiling fan in room Q-311 wobbles badly and makes a loud grinding noise at high speed. It looks like it could come loose.",
    severity: "HIGH",
    location: "Room Q-311",
    hoursAgo: 12,
  },
  {
    studentIndex: 3,
    category: "CLEANLINESS_SANITATION",
    title: "Garbage not collected from the corridor for four days",
    description:
      "The dustbins on the first floor of Q block have not been emptied since Monday. There is a bad smell and flies in the corridor.",
    severity: "MEDIUM",
    location: "Q block, first floor corridor",
    hoursAgo: 96,
  },
  {
    studentIndex: 2,
    category: "FURNITURE",
    title: "Broken study chair",
    description:
      "One of the legs of the study chair in Q-311 has cracked and it is not safe to sit on any more.",
    severity: "LOW",
    location: "Room Q-311",
    hoursAgo: 5,
  },
];

async function main() {
  console.log("→ Connecting to MongoDB…");
  await connectDB();

  console.log("→ Ensuring system settings…");
  await ensureSettings();

  /* --- Staff ------------------------------------------------------------- */
  console.log("→ Seeding staff accounts…");
  const passwordHash = await hashPassword(password);
  const staffIds: Record<string, string> = {};

  for (const person of staff) {
    const existing = await User.findOne({ email: person.email });
    if (existing) {
      existing.name = person.name;
      existing.role = person.role;
      existing.hostel = person.hostel;
      existing.isActive = true;
      await existing.save();
      staffIds[person.key] = String(existing._id);
      console.log(`   • kept   ${person.role.padEnd(11)} ${person.email}`);
    } else {
      const doc = await User.create({
        role: person.role,
        name: person.name,
        email: person.email,
        passwordHash,
        hostel: person.hostel,
        isActive: true,
        emailVerified: true,
        mustChangePassword: true,
        tokenVersion: 0,
      });
      staffIds[person.key] = String(doc._id);
      console.log(`   • create ${person.role.padEnd(11)} ${person.email}`);
    }
  }

  /* --- Workers ----------------------------------------------------------- */
  console.log("→ Seeding the worker registry…");
  const coordinatorId = staffIds.COORDINATOR;
  for (const worker of workers) {
    await Worker.findOneAndUpdate(
      { name: worker.name },
      {
        $set: {
          name: worker.name,
          phone: worker.phone,
          trade: worker.trade,
          hostels: worker.hostels,
          isActive: true,
        },
        $setOnInsert: { createdBy: coordinatorId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`   • ${workers.length} workers ready`);

  if (!env.seedDemoData) {
    console.log("→ SEED_DEMO_DATA is off — skipping demo students and complaints.");
    await summary(staffIds);
    return;
  }

  /* --- Demo students ----------------------------------------------------- */
  console.log("→ Seeding demo students…");
  const studentIds: string[] = [];
  for (const student of demoStudents) {
    const [session, department] = student.regNo.split("-");
    const doc = await User.findOneAndUpdate(
      { regNo: student.regNo },
      {
        $set: {
          role: "STUDENT",
          name: student.name,
          email: student.email,
          hostel: student.hostel,
          roomNo: student.roomNo,
          department,
          session: Number(session),
          isActive: true,
          emailVerified: true,
        },
        $setOnInsert: { passwordHash, tokenVersion: 0, mustChangePassword: false },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    studentIds.push(String(doc!._id));
  }
  console.log(`   • ${demoStudents.length} demo students ready`);

  /* --- Demo complaints --------------------------------------------------- */
  const existingDemo = await Complaint.countDocuments({
    "student.regNo": { $in: demoStudents.map((s) => s.regNo) },
  });

  if (existingDemo > 0) {
    console.log(`→ ${existingDemo} demo complaints already exist — skipping.`);
  } else {
    console.log("→ Seeding demo complaints…");
    for (const spec of demoComplaints) {
      const student = demoStudents[spec.studentIndex];
      const studentId = studentIds[spec.studentIndex];
      const createdAt = new Date(Date.now() - spec.hoursAgo * 3_600_000);
      const code = await nextComplaintCode(createdAt);
      const sla = computeSlaDueDates(createdAt, spec.severity, DEFAULT_SETTINGS as never);

      const complaint = await Complaint.create({
        code,
        student: {
          userId: studentId,
          regNo: student.regNo,
          name: student.name,
          email: student.email,
          roomNo: student.roomNo,
        },
        hostel: student.hostel,
        category: spec.category,
        title: spec.title,
        description: spec.description,
        location: spec.location,
        severity: spec.severity,
        status: "SUBMITTED",
        priorityScore: computePriorityScore(
          {
            severity: spec.severity,
            category: spec.category,
            status: "SUBMITTED",
            createdAt,
          },
          DEFAULT_SETTINGS.priorityWeights,
        ),
        sla: {
          ackDueAt: sla.ackDueAt,
          resolveDueAt: sla.resolveDueAt,
          ackBreached: false,
          resolveBreached: false,
          firstResponseAt: null,
        },
        lastActivityAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      });

      await ComplaintEvent.create({
        complaintId: complaint._id,
        complaintCode: code,
        actorId: studentId,
        actorName: student.name,
        actorRole: "STUDENT",
        action: "CREATED",
        toStatus: "SUBMITTED",
        message: spec.description,
        visibility: "PUBLIC",
        createdAt,
      });
    }
    console.log(`   • ${demoComplaints.length} demo complaints created`);
  }

  /* --- A sample notice --------------------------------------------------- */
  const hasNotice = await Announcement.countDocuments();
  if (!hasNotice) {
    await Announcement.create({
      title: "Water supply maintenance on Sunday",
      body: "The main water tank will be cleaned this Sunday between 9 am and 1 pm. Water supply to all three hostels will be interrupted during this window. Please store water in advance. You do not need to file a complaint about this.",
      hostels: ["GIRLS", "QASIM", "FATIMA"],
      audience: "ALL",
      tone: "warning",
      pinned: true,
      startsAt: new Date(),
      createdBy: staffIds.WARDEN,
      createdByName: staff.find((s) => s.key === "WARDEN")!.name,
    });
    console.log("→ Sample notice board entry created.");
  }

  await summary(staffIds);
}

async function summary(staffIds: Record<string, string>) {
  const counts = {
    users: await User.countDocuments(),
    complaints: await Complaint.countDocuments(),
    workers: await Worker.countDocuments(),
    counters: await Counter.countDocuments(),
  };

  console.log("\n──────────────────────────────────────────────────────────");
  console.log("  SEED COMPLETE");
  console.log("──────────────────────────────────────────────────────────");
  console.log(`  Users: ${counts.users}   Complaints: ${counts.complaints}   Workers: ${counts.workers}`);
  console.log("\n  STAFF SIGN-IN (all must change their password on first login)");
  for (const person of staff) {
    const scope = person.hostel ? HOSTEL_META[person.hostel].label : "All hostels";
    console.log(`   ${person.role.padEnd(11)} ${person.email.padEnd(32)} ${scope}`);
  }
  if (env.seedDemoData) {
    console.log("\n  DEMO STUDENTS");
    for (const student of demoStudents) {
      console.log(`   ${student.regNo.padEnd(14)} ${student.email.padEnd(32)} ${HOSTEL_META[student.hostel].label}`);
    }
  }
  console.log(`\n  Password for every seeded account: ${password}`);
  console.log("  Change SEED_DEFAULT_PASSWORD in .env.local before seeding production.");
  console.log("──────────────────────────────────────────────────────────\n");
  void staffIds;
}

main()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\n✗ Seed failed:", error);
    await disconnectDB();
    process.exit(1);
  });
