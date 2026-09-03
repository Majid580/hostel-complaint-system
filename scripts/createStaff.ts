/**
 * Creates one staff account from the command line.
 *
 *   npm run create-staff -- --role RT --hostel QASIM \
 *                           --name "Ayesha Khan" --email ayesha@example.edu
 *
 * Options:
 *   --role      RT | WARDEN | COORDINATOR            (required)
 *   --name      full name                            (required)
 *   --email     e-mail address, used to sign in      (required)
 *   --hostel    GIRLS | QASIM | FATIMA               (required for RT)
 *   --phone     contact number                       (optional)
 *   --password  set explicitly instead of generating (optional)
 *
 * Why this exists as well as the Coordinator's UI: the very first Coordinator
 * has nobody to create them. This is the bootstrap path, and the recovery path
 * when everyone is locked out.
 *
 * It applies the same rules as POST /api/users — unique e-mail, one active RT
 * per hostel, a forced password change on first sign-in — but it prints the
 * temporary password to the terminal instead of e-mailing it, so it works
 * before SMTP is configured.
 */
import crypto from "node:crypto";
import { connectDB, disconnectDB } from "../src/lib/db/mongoose";
import { User } from "../src/models";
import { hashPassword } from "../src/lib/auth/password";
import { createStaffSchema } from "../src/lib/validation/schemas";
import { HOSTELS, ROLE_META, type Hostel } from "../src/lib/domain/constants";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function die(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) {
    console.log(
      [
        "",
        "  Create a staff account",
        "",
        '    npm run create-staff -- --role RT --hostel QASIM --name "Ayesha Khan" \\',
        "                            --email ayesha@example.edu",
        "",
        `    --role      RT | WARDEN | COORDINATOR`,
        `    --hostel    ${HOSTELS.join(" | ")}   (required for RT)`,
        "    --name      full name",
        "    --email     e-mail address",
        "    --phone     contact number          (optional)",
        "    --password  explicit password       (optional; generated otherwise)",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  const parsed = createStaffSchema.safeParse({
    name: args.name ?? "",
    email: args.email ?? "",
    phone: args.phone,
    role: args.role,
    hostel: args.hostel,
    password: args.password,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `    ${i.path.join(".") || "input"}: ${i.message}`)
      .join("\n");
    die(`Invalid arguments:\n\n${issues}`);
  }

  const data = parsed.data;

  await connectDB();

  const existing = await User.findOne({ email: data.email }).select("_id name").lean();
  if (existing) {
    die(`An account already exists for ${data.email} (${existing.name}).`);
  }

  if (data.role === "RT" && data.hostel) {
    const currentRt = await User.findOne({
      role: "RT",
      hostel: data.hostel as Hostel,
      isActive: true,
    })
      .select("name email")
      .lean();
    if (currentRt) {
      die(
        `${currentRt.name} (${currentRt.email}) is already the active Resident Tutor for ` +
          `${data.hostel}. Deactivate that account first — one active RT per hostel keeps ` +
          `complaint routing unambiguous.`,
      );
    }
  }

  const temporaryPassword =
    data.password ?? `Hcms-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const user = await User.create({
    role: data.role,
    name: data.name,
    email: data.email,
    phone: data.phone || undefined,
    hostel: data.role === "RT" ? data.hostel : undefined,
    passwordHash: await hashPassword(temporaryPassword),
    isActive: true,
    emailVerified: true,
    mustChangePassword: true,
    tokenVersion: 0,
  });

  console.log(
    [
      "",
      `  ✔ Created ${ROLE_META[user.role].label}: ${user.name}`,
      "",
      `    Sign in with : ${user.email}`,
      `    Password     : ${temporaryPassword}`,
      user.hostel ? `    Hostel       : ${user.hostel}` : null,
      "",
      "  They must change this password the first time they sign in.",
      "  Nothing was e-mailed — give them the password over a channel you trust.",
      "",
    ]
      .filter((line) => line !== null)
      .join("\n"),
  );
}

main()
  .catch((error) => {
    console.error("\n  ✖ Failed to create the account:\n", error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
