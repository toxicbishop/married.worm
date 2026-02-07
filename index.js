const jsonfile = require("jsonfile");
const moment = require("moment");
const simpleGit = require("simple-git");
const fs = require("fs");
const path = require("path");

const FILE_PATH = "./data.json";
const TEMP_FILE_PATH = path.join(__dirname, ".commits_to_delete.json");

// Helper function to get a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
  const DATE = moment()
    .subtract(1, "y")
    .add(1, "d")
    .add(x, "w")
    .add(y, "d")
    .format();

  const data = {
    date: DATE,
  };

  console.log(`Creating commit for date: ${DATE}`);

  jsonfile.writeFile(FILE_PATH, data, () => {
    simpleGit()
      .add([FILE_PATH])
      .commit(DATE, { "--date": DATE }, makeCommit.bind(this, --n));
  });
};

// Function to delete the last n commits (simple reset)
const deleteCommits = async (n) => {
  console.log(`Deleting last ${n} commits...`);
  const git = simpleGit();
  try {
    await git.reset(["--hard", `HEAD~${n}`]);
    await git.push(["origin", "+HEAD"]);
    console.log("Successfully deleted commits and force pushed to remote.");
  } catch (err) {
    console.error("Error deleting commits:", err);
  }
};

// Function to find commits by date
const getCommitsByDate = async (dateStr) => {
  const git = simpleGit();
  const log = await git.log();
  const targetDate = moment(dateStr).format("YYYY-MM-DD");

  return log.all
    .filter((commit) => {
      return moment(commit.date).format("YYYY-MM-DD") === targetDate;
    })
    .map((commit) => commit.hash);
};

// Function to find commits by date range with exclusions
const getCommitsByRange = async (
  startDateStr,
  endDateStr,
  excludeDates = [],
) => {
  const git = simpleGit();
  const log = await git.log();
  const start = moment(startDateStr);
  const end = moment(endDateStr);
  const excludes = excludeDates.map((d) => moment(d).format("YYYY-MM-DD"));

  return log.all
    .filter((commit) => {
      const commitDate = moment(commit.date);
      const dateStr = commitDate.format("YYYY-MM-DD");
      return (
        commitDate.isBetween(start, end, "day", "[]") &&
        !excludes.includes(dateStr)
      );
    })
    .map((commit) => commit.hash);
};

// Function to delete specific commits using rebase
const deleteCommitsByHashes = async (hashes) => {
  if (hashes.length === 0) {
    console.log("No commits found to delete.");
    return;
  }

  console.log(`Found ${hashes.length} commits to delete.`);
  const git = simpleGit();

  // Save hashes to a temp file for the editor to read
  jsonfile.writeFileSync(TEMP_FILE_PATH, hashes);

  // We need to rebase from the parent of the oldest commit we want to delete
  // To be safe and simple, we'll rebase from root or a far back point if possible,
  // but finding the exact parent of the oldest commit is better.
  // For simplicity in this script, we'll try to rebase the last 500 commits (assuming the target is within reach)
  // or just rebase from root if supported.
  // A safer bet without traversing the whole tree is `git rebase -i --root` but that can be slow.
  // Let's use `HEAD~N` where N covers the commits.

  try {
    // Set GIT_SEQUENCE_EDITOR to this script with --editor flag
    const editorCommand = `node "${__filename}" --editor`;
    const env = { ...process.env, GIT_SEQUENCE_EDITOR: editorCommand };

    console.log("Starting interactive rebase...");
    // We use --root to ensure we can reach any commit.
    // WARNING: This might be slow on huge repos.
    // Added -Xtheirs to automatically resolve conflicts by taking the incoming change (the one being applied)
    // This is crucial because data.json is often rewritten.
    // Added --autostash to handle dirty working directory automatically
    await git.env(env).rebase(["-i", "--root", "-Xtheirs", "--autostash"]);

    await git.push(["origin", "+HEAD"]);
    console.log("Successfully deleted specific commits and force pushed.");
  } catch (err) {
    console.error("Error during rebase:", err);
    console.log(
      'You may need to run "git rebase --abort" manually if the process failed midway.',
    );
  } finally {
    if (fs.existsSync(TEMP_FILE_PATH)) {
      fs.unlinkSync(TEMP_FILE_PATH);
    }
  }
};

// Editor function used by git rebase
const runEditor = (filePath) => {
  const hashesToDelete = jsonfile.readFileSync(TEMP_FILE_PATH);
  const content = fs.readFileSync(filePath, "utf8");

  const lines = content.split("\n");
  const newLines = lines.map((line) => {
    const parts = line.split(" ");
    if (parts.length > 1 && (parts[0] === "pick" || parts[0] === "p")) {
      const hash = parts[1];
      // Check if this hash (short or long) is in our delete list
      // git rebase usually gives short hashes
      const toDelete = hashesToDelete.some(
        (h) => h.startsWith(hash) || hash.startsWith(h),
      );
      if (toDelete) {
        return `drop ${hash} ${parts.slice(2).join(" ")}`;
      }
    }
    return line;
  });

  fs.writeFileSync(filePath, newLines.join("\n"));
};

// Main execution parsing
const args = process.argv.slice(2);

(async () => {
  if (args.includes("--editor")) {
    const filePath = args[args.length - 1]; // Git passes the file path as the last argument
    runEditor(filePath);
    return;
  }

  if (args.includes("--delete-date")) {
    const index = args.indexOf("--delete-date");
    const date = args[index + 1];
    if (date) {
      const hashes = await getCommitsByDate(date);
      await deleteCommitsByHashes(hashes);
    } else {
      console.error("Please specify the date (YYYY-MM-DD)");
    }
  } else if (args.includes("--delete-range")) {
    const index = args.indexOf("--delete-range");
    const start = args[index + 1];
    const end = args[index + 2];

    // simple arg parsing for optional exclude
    let excludeDates = [];
    if (args.includes("--exclude-date")) {
      const exIndex = args.indexOf("--exclude-date");
      if (args[exIndex + 1]) {
        excludeDates = args[exIndex + 1].split(",");
      }
    }

    if (start && end) {
      const hashes = await getCommitsByRange(start, end, excludeDates);
      await deleteCommitsByHashes(hashes);
    } else {
      console.error("Please specify start and end dates (YYYY-MM-DD)");
    }
  } else if (args.includes("--delete")) {
    const index = args.indexOf("--delete");
    const n = parseInt(args[index + 1]);
    if (!isNaN(n)) {
      await deleteCommits(n);
    } else {
      console.error("Please specify number of commits to delete");
    }
  } else if (args.includes("--add")) {
    const index = args.indexOf("--add");
    const n = parseInt(args[index + 1]);
    if (!isNaN(n)) {
      makeCommit(n);
    } else {
      console.error("Please specify number of commits to add");
    }
  } else {
    // Default behavior
    makeCommit(150);
  }
})();
