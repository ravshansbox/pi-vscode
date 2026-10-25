class EventEmitter {
  listeners = new Set();
  event = (fn) => {
    this.listeners.add(fn);
    return { dispose: () => this.listeners.delete(fn) };
  };
  fire(value) {
    for (const fn of this.listeners) fn(value);
  }
}

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Selection {
  constructor(anchor, active) {
    this.anchor = anchor;
    this.active = active;
    const anchorFirst = anchor.line < active.line || (anchor.line === active.line && anchor.character <= active.character);
    this.start = anchorFirst ? anchor : active;
    this.end = anchorFirst ? active : anchor;
    this.isEmpty = anchor.line === active.line && anchor.character === active.character;
  }
}

class TabInputText {
  constructor(uri) {
    this.uri = uri;
  }
}

const Uri = { file: (fsPath) => ({ scheme: "file", fsPath }) };

const events = {
  activeEditor: new EventEmitter(),
  selection: new EventEmitter(),
  close: new EventEmitter(),
  delete: new EventEmitter(),
  rename: new EventEmitter(),
  save: new EventEmitter(),
};

const window = {
  activeTextEditor: undefined,
  tabGroups: { all: [] },
  onDidChangeActiveTextEditor: events.activeEditor.event,
  onDidChangeTextEditorSelection: events.selection.event,
  createOutputChannel: () => ({ appendLine: () => {} }),
};

const workspace = {
  workspaceFolders: [{ uri: Uri.file("/ws") }],
  isTrusted: true,
  onDidCloseTextDocument: events.close.event,
  onDidDeleteFiles: events.delete.event,
  onDidRenameFiles: events.rename.event,
  onDidSaveTextDocument: events.save.event,
};

module.exports = { EventEmitter, Position, Selection, TabInputText, Uri, window, workspace, events };
