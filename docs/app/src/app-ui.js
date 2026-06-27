export function createDefaultAppUi({ document, window, colors, actions }) {
  const elements = queryDefaultElements(document);
  const state = {
    selectedColor: null,
    renderedColor: null,
    renderedName: null,
    renderedRoomId: null,
    toastTimer: 0
  };

  bindDefaultUi(elements, actions);

  return {
    sceneHost: elements.sceneHost,
    canShowDebug: true,
    render(view) {
      state.selectedColor = view.selectedColor ?? state.selectedColor;
      document.body.dataset.uiChrome = view.uiMode ?? "default";
      elements.lobby.hidden = view.phase !== "lobby";
      elements.space.hidden = view.phase !== "room";

      const nextName = view.identity?.name ?? "";
      const nextRoomId = view.roomId ?? "";
      if (state.renderedName !== nextName) {
        setInputValue(elements.nameInput, nextName);
        state.renderedName = nextName;
      }
      if (state.renderedRoomId !== nextRoomId) {
        setInputValue(elements.roomInput, nextRoomId);
        state.renderedRoomId = nextRoomId;
      }
      elements.lobbyNote.textContent = view.lobbyNote ?? "";

      renderColorChoices({
        colorGrid: elements.colorGrid,
        colors,
        selectedColor: state.selectedColor,
        renderedColor: state.renderedColor,
        onSelectColor: actions.onSelectColor
      });
      state.renderedColor = state.selectedColor;

      elements.roomLabel.textContent = `Room ${view.roomId ?? ""}`;
      elements.roomTitle.textContent = view.identity?.name ?? "Lumen Space";
      elements.connectionStatus.textContent = view.status?.text ?? "Starting";
      elements.connectionStatus.dataset.state = view.status?.state ?? "pending";
      renderPeople(elements, view.participants ?? []);
      renderSoundControl(elements, view.sound);
      renderDebug(elements, view.debug);
    },
    setGenerateNameBusy(isBusy) {
      elements.generateNameButton.disabled = Boolean(isBusy);
    },
    focusName() {
      elements.nameInput.focus();
      elements.nameInput.select();
    },
    showToast(message) {
      elements.toast.textContent = message;
      elements.toast.hidden = false;
      window.clearTimeout(state.toastTimer);
      state.toastTimer = window.setTimeout(() => {
        elements.toast.hidden = true;
      }, 3_200);
    }
  };
}

export function createSceneOnlyAppUi({ document }) {
  const lobby = document.querySelector("#lobby");
  const space = document.querySelector("#space");
  const sceneHost = document.querySelector("#scene-host");
  const hiddenElements = [
    document.querySelector(".top-bar"),
    document.querySelector("#connection-status"),
    document.querySelector(".people-panel"),
    document.querySelector(".action-bar"),
    document.querySelector("#debug-panel"),
    document.querySelector("#toast")
  ].filter(Boolean);

  hideChrome();

  return {
    sceneHost,
    canShowDebug: false,
    render(view) {
      document.body.dataset.uiChrome = view.uiMode ?? "scene-only";
      if (lobby) {
        lobby.hidden = true;
      }
      if (space) {
        space.hidden = view.phase !== "room";
      }
      hideChrome();
    },
    setGenerateNameBusy() {},
    focusName() {},
    showToast() {}
  };

  function hideChrome() {
    for (const element of hiddenElements) {
      element.hidden = true;
    }
  }
}

function queryDefaultElements(document) {
  return {
    lobby: document.querySelector("#lobby"),
    joinForm: document.querySelector("#join-form"),
    nameInput: document.querySelector("#name-input"),
    generateNameButton: document.querySelector("#generate-name-button"),
    roomInput: document.querySelector("#room-input"),
    colorGrid: document.querySelector("#color-grid"),
    lobbyNote: document.querySelector("#lobby-note"),
    createRoomButton: document.querySelector("#create-room-button"),
    space: document.querySelector("#space"),
    sceneHost: document.querySelector("#scene-host"),
    roomLabel: document.querySelector("#room-label"),
    roomTitle: document.querySelector("#room-title"),
    connectionStatus: document.querySelector("#connection-status"),
    peopleList: document.querySelector("#people-list"),
    peerCount: document.querySelector("#peer-count"),
    copyLinkButton: document.querySelector("#copy-link-button"),
    addBotButton: document.querySelector("#add-bot-button"),
    removeBotButton: document.querySelector("#remove-bot-button"),
    pulseButton: document.querySelector("#pulse-button"),
    soundButton: document.querySelector("#sound-button"),
    leaveButton: document.querySelector("#leave-button"),
    debugPanel: document.querySelector("#debug-panel"),
    debugOutput: document.querySelector("#debug-output"),
    toast: document.querySelector("#toast")
  };
}

function bindDefaultUi(elements, actions) {
  elements.nameInput.addEventListener("input", () => {
    actions.onNameEdited?.(elements.nameInput.value);
  });
  elements.generateNameButton.addEventListener("click", () => {
    actions.onGenerateName?.();
  });
  elements.createRoomButton.addEventListener("click", () => {
    actions.onCreateRoom?.();
  });
  elements.joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.onJoinRoom?.({
      name: elements.nameInput.value,
      roomId: elements.roomInput.value
    });
  });
  elements.copyLinkButton.addEventListener("click", () => {
    actions.onCopyInvite?.();
  });
  elements.addBotButton.addEventListener("click", () => {
    actions.onAddBot?.();
  });
  elements.removeBotButton.addEventListener("click", () => {
    actions.onRemoveBot?.();
  });
  elements.pulseButton.addEventListener("click", () => {
    actions.onPulse?.();
  });
  elements.soundButton.addEventListener("click", () => {
    actions.onToggleSound?.();
  });
  elements.leaveButton.addEventListener("click", () => {
    actions.onLeaveRoom?.();
  });
  elements.roomLabel.addEventListener("dblclick", handleDebugToggle);
  elements.roomTitle.addEventListener("dblclick", handleDebugToggle);

  function handleDebugToggle(event) {
    event.preventDefault();
    actions.onToggleDebug?.();
  }
}

function setInputValue(input, value) {
  if (input.value !== value && input.ownerDocument.activeElement !== input) {
    input.value = value;
  }
}

function renderColorChoices({
  colorGrid,
  colors,
  selectedColor,
  renderedColor,
  onSelectColor
}) {
  if (renderedColor === selectedColor && colorGrid.childElementCount === colors.length) {
    return;
  }

  colorGrid.replaceChildren(
    ...colors.map((color) => {
      const button = colorGrid.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "color-choice";
      button.style.setProperty("--choice-color", color);
      button.setAttribute("aria-label", `Use color ${color}`);
      button.setAttribute("aria-pressed", String(color === selectedColor));
      button.addEventListener("click", () => {
        onSelectColor?.(color);
      });
      return button;
    })
  );
}

function renderSoundControl(elements, sound) {
  const isAvailable = Boolean(sound?.available);
  const isEnabled = Boolean(sound?.enabled);
  elements.soundButton.hidden = !isAvailable;
  elements.soundButton.textContent = isEnabled ? "Sound On" : "Sound Off";
  elements.soundButton.title = isEnabled ? "Mute sound effects" : "Unmute sound effects";
  elements.soundButton.setAttribute("aria-label", elements.soundButton.title);
  elements.soundButton.setAttribute("aria-pressed", String(isEnabled));
}

function renderPeople(elements, participants) {
  elements.peerCount.textContent = String(participants.length);
  elements.peopleList.replaceChildren(
    ...participants.map((participant) => {
      const row = document.createElement("li");
      row.className = "person-row";
      row.innerHTML = `
        <span class="person-swatch" style="--person-color: ${participant.color}"></span>
        <span class="person-name"></span>
        <span class="person-meta">${participant.isLocal ? "you" : participant.isBot ? "bot" : "live"}</span>
      `;
      row.querySelector(".person-name").textContent = participant.name;
      return row;
    })
  );
}

function renderDebug(elements, debug) {
  const isVisible = Boolean(debug?.visible);
  elements.debugPanel.hidden = !isVisible;
  elements.debugOutput.textContent = isVisible ? formatDebugRows(debug.rows ?? []) : "";
}

function formatDebugRows(rows) {
  return rows
    .map((row) => {
      const botAiText = row.ai ? ` ${formatBotAiDebug(row.ai)}` : "";
      return (
        `${row.kind.padEnd(5)} ${row.name.padEnd(18)} ` +
        `p(${formatDebugVector(row.position)}) ` +
        `v(${formatDebugVector(row.velocity)}) ` +
        `s=${formatDebugNumber(row.speed)}` +
        botAiText
      );
    })
    .join("\n");
}

function formatBotAiDebug(ai) {
  const target = ai.targetStarId ?? "drift";
  const distance = formatDebugNullableNumber(ai.targetDistance);
  return `ai(target=${target} d=${distance})`;
}

function formatDebugVector(vector) {
  return [
    formatDebugNumber(vector.x),
    formatDebugNumber(vector.y),
    formatDebugNumber(vector.z)
  ].join(", ");
}

function formatDebugNumber(value) {
  return Number(value).toFixed(2).padStart(6, " ");
}

function formatDebugNullableNumber(value) {
  return value === null || value === undefined ? "--" : Number(value).toFixed(2);
}
