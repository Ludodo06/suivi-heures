// The screen shown before a profile is connected.

import { el, segmented } from "../dom.js";
import { icon } from "../icons.js";
import { countOldLocalSessions, createProfile, signIn } from "../storage.js";

const root = document.getElementById("login-root");

const ERROR_MESSAGES = {
  "profile/invalid-name": "Le nom doit faire 2 à 30 caractères : lettres, chiffres, espaces ou tirets.",
  "profile/invalid-invite": "Code d'invitation incorrect.",
  "auth/invalid-credential": "Nom ou mot de passe incorrect.",
  "auth/wrong-password": "Nom ou mot de passe incorrect.",
  "auth/user-not-found": "Nom ou mot de passe incorrect.",
  "auth/email-already-in-use": "Ce nom est déjà pris.",
  "auth/weak-password": "Le mot de passe doit faire au moins 6 caractères.",
  "auth/too-many-requests": "Trop d'essais. Réessaie dans quelques minutes.",
  "auth/network-request-failed": "Pas de réseau. Vérifie ta connexion.",
};

function field(id, label, input) {
  input.id = id;
  input.required = true;
  return el("div", {}, el("label", { className: "field", htmlFor: id, textContent: label }), input);
}

/**
 * Shows the screen and waits for a connected profile.
 *
 * Returns:
 *   A promise that ends when a profile is connected.
 */
export function showLogin() {
  return new Promise((resolve) => {
    let mode = "signIn";

    function render() {
      const isNew = mode === "create";
      const nameInput = el("input", { type: "text", autocomplete: "username", autocapitalize: "none", maxLength: 30 });
      const passwordInput = el("input", { type: "password", autocomplete: isNew ? "new-password" : "current-password" });
      const inviteInput = el("input", { type: "text", autocomplete: "off", autocapitalize: "characters" });
      const error = el("p", { id: "login-error", className: "form-error", hidden: true });
      const submit = el("button", { id: "login-submit", type: "submit", className: "primary full", textContent: isNew ? "Créer mon profil" : "Se connecter" });

      const handleSubmit = async (event) => {
        event.preventDefault();
        submit.disabled = true;
        error.hidden = true;
        try {
          if (isNew) {
            const oldCount = countOldLocalSessions();
            const keepOldData = oldCount > 0 && confirm(`Reprendre les ${oldCount} périodes déjà enregistrées sur cet appareil ?`);
            await createProfile(nameInput.value, passwordInput.value, inviteInput.value.trim(), keepOldData);
          } else {
            await signIn(nameInput.value, passwordInput.value);
          }
          root.hidden = true;
          resolve();
        } catch (failure) {
          error.textContent = ERROR_MESSAGES[failure.code] ?? "Une erreur est survenue. Réessaie.";
          error.hidden = false;
          submit.disabled = false;
        }
      };

      root.replaceChildren(
        el(
          "div",
          { className: "login-card" },
          el("span", { className: "login-logo" }, icon("today", 32)),
          el("h1", { textContent: "Suivi d'heures" }),
          segmented(
            [
              ["signIn", "Connexion"],
              ["create", "Nouveau profil"],
            ],
            mode,
            (value) => {
              mode = value;
              render();
            },
          ),
          el(
            "form",
            { id: "login-form", onsubmit: handleSubmit },
            field("login-name", "Nom du profil", nameInput),
            field("login-password", "Mot de passe", passwordInput),
            isNew && field("login-invite", "Code d'invitation", inviteInput),
            isNew && el("p", { className: "muted", textContent: "Garde bien ton mot de passe : il ne peut pas être récupéré." }),
            error,
            submit,
          ),
          el("a", { className: "login-demo", href: "./?demo=1", textContent: "Voir un exemple sans compte" }),
        ),
      );
    }

    root.hidden = false;
    render();
  });
}
