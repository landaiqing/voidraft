export const languages = [
  {
    name: "Shell",
    parsers: ["sh"],
    extensions: [
      ".sh",
      ".bash", 
      ".zsh",
      ".fish",
      ".ksh",
      ".csh",
      ".tcsh",
      ".ash",
      ".dash"
    ],
    filenames: [
      "*.sh",
      "*.bash",
      ".bashrc",
      ".bash_profile",
      ".bash_login",
      ".bash_logout",
      ".zshrc",
      ".profile"
    ],
    interpreters: [
      "bash",
      "sh",
      "zsh",
      "fish",
      "ksh",
      "csh", 
      "tcsh",
      "ash",
      "dash"
    ],
    tmScope: "source.shell",
    aceMode: "sh",
    codemirrorMode: "shell",
    linguistLanguageId: 302,
    vscodeLanguageIds: ["shellscript"]
  },
  {
    name: "Dockerfile",
    parsers: ["dockerfile"],
    extensions: [".dockerfile"],
    filenames: [
      "Dockerfile",
      "*.dockerfile",
      "Containerfile",
      "*.containerfile"
    ],
    tmScope: "source.dockerfile",
    aceMode: "dockerfile",
    codemirrorMode: "dockerfile",
    linguistLanguageId: 99,
    vscodeLanguageIds: ["dockerfile"]
  }
];

