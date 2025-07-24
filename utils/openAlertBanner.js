const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { currentBanditFindings } = require("./sast"); // תתאים את הנתיב בהתאם למיקום הקובץ שלך

let currentTrivyFindings = []; // אפשר להעביר ערכים בצורה דינמית אם צריך
let currentFindings = [];      // אותו דבר כאן

function setCurrentFindings(findings) {
  currentFindings = findings;
}

function setCurrentTrivyFindings(findings) {
  currentTrivyFindings = findings;
}

function openAlertBanner(alertItem) {
  const id =
    alertItem.RuleID ||
    alertItem.VulnerabilityID ||
    alertItem.test_name ||
    "Unknown";
  const panelTitle = `Alert: ${id}`;

  const alertPanel = vscode.window.createWebviewPanel(
    "alertDetail",
    panelTitle,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, "..", "UI"))], // תקן את הנתיב במידת הצורך
    }
  );

  const htmlPath = path.join(__dirname, "..", "UI", "alertpage.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  let reportData = [];

  if (alertItem.VulnerabilityID) {
    // Trivy
    if (
      typeof currentTrivyFindings !== "undefined" &&
      currentTrivyFindings.Results
    ) {
      reportData = currentTrivyFindings.Results.flatMap(
        (result) => result.Vulnerabilities || []
      );
    }
  } else if (
    alertItem.test_name ||
    alertItem.issue_text ||
    alertItem.issue_severity
  ) {
    // Bandit
    if (
      typeof currentBanditFindings !== "undefined" &&
      Array.isArray(currentBanditFindings)
    ) {
      reportData = currentBanditFindings;
    }
  } else {
    // Gitleaks
    if (typeof currentFindings !== "undefined") {
      reportData = currentFindings;
    }
  }

  const filePath =
    alertItem.file ||
    alertItem.File ||
    alertItem.FilePath ||
    (alertItem.Location && alertItem.Location.Path) ||
    alertItem.filename ||
    alertItem.file_path ||
    "";

  const startLine =
    alertItem.line ||
    alertItem.line_number ||
    alertItem.Line ||
    alertItem.StartLine ||
    (alertItem.Location && alertItem.Location.StartLine) ||
    (alertItem.location && alertItem.location.start?.line) ||
    0;

  html = html.replace(
    "</head>",
    `<script>
      const reportData = ${JSON.stringify(reportData)};
      const targetRuleID = "${id}";
      const targetStartLine = ${startLine || 0};
      const alertItem = ${JSON.stringify(alertItem)};
      const filePath = ${JSON.stringify(filePath)};
    </script></head>`
  );

  console.log("🔍 openAlertBanner alertItem:", alertItem);
  console.log("🔍 openAlertBanner reportData length:", reportData.length);
  console.log("🔍 openAlertBanner first reportData item:", reportData[0]);


  alertPanel.webview.html = html;

  alertPanel.webview.onDidReceiveMessage(
    (message) => {
      if (message.command === "goToLine") {
        const { filePath, lineNumber } = message;
        if (filePath && lineNumber) {
          const uri = vscode.Uri.file(filePath);
          vscode.workspace.openTextDocument(uri).then((doc) => {
            vscode.window.showTextDocument(doc, {
              selection: new vscode.Range(
                new vscode.Position(lineNumber - 1, 0),
                new vscode.Position(lineNumber - 1, Number.MAX_SAFE_INTEGER)
              ),
            });
          });
        }
      }
    },
    undefined,
    []
  );
}

module.exports = {
  openAlertBanner,
  setCurrentFindings,
  setCurrentTrivyFindings,
};
