let inMemoryJwtDoNotPersist = undefined;

// nonce to prevent replay attacks
async function getSecureNonce() {
  return crypto.randomUUID().replace(/-/g, "");
}

// Automatic SIWF flow
async function handleAutomaticSignIn() {
  const connectElement = document.getElementById("farcaster-connnect");
  try {
    const nonce = await getSecureNonce();
    if (!nonce) {
      const error = new Error("Secure nonce not available");
      resultsDiv.textContent += `Nonce validation failed: ${error.message}\n`;
      throw error;
    }

    const result = await frame.sdk.actions.signIn({ nonce });
    const context = await frame.sdk.context;
    const insecureFid = context?.user?.fid;

    // Send to server for verification
    connectElement.textContent = "Verifying signature...";
    const response = await fetch("/api/verify-signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        signature: result.signature,
        message: result.message,
        fid: insecureFid,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to verify SIWF");
    }

    const data = await response.json();

    if (data.fid !== insecureFid) {
      throw new Error("Mismatched credentials");
    }

    // token stored in memory only, is fragile
    inMemoryJwtDoNotPersist = data.token;

    // Update UI
    connectElement.className = "farcaster-connect connected";
    connectElement.textContent = `Connected as FID: ${data.fid}`;

    // Only fetch protected results after successful sign-in
    await fetchProtectedResults();

    // Hide the connect element after 3 seconds
    setTimeout(() => {
      connectElement.hidden = true;
    }, 3000);
  } catch (error) {
    console.error("Automatic sign-in failed:", error);
    connectElement.className = "farcaster-connect error";
    connectElement.textContent = `Connection failed: ${error.message}`;
    // Don't fetch protected results if sign-in failed
    document.getElementById("secureDiv").hidden = true;
  }
}

async function handleSignOut() {
  if (inMemoryJwtDoNotPersist) {
    try {
      const response = await fetch("/api/protected/signout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${inMemoryJwtDoNotPersist}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Sign out failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (err) {
      console.error("Error during sign out:", err);
    } finally {
      // Always clear memory, even if API call fails
      inMemoryJwtDoNotPersist = undefined;
      // Fetch protected results after sign-out (will show error due to missing token)
      await fetchProtectedResults();
    }
  }
}

async function fetchCastData() {
  try {
    const { text } = await getClipboardContent();

    // Show/hide clear clipboard button based on content
    const clearButton = document.getElementById("clear-clipboard-container");
    clearButton.hidden = !text || text.trim() === "";

    if (!text || text.trim() === "") {
      return null;
    }

    // Call the API
    const response = await fetch(`/api/${encodeURIComponent(text)}`, {
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    if (!response.ok) {
      throw new Error(`${text}: Unable to find cast ${response.status}`);
    }
    const data = await response.json();

    return data;
  } catch (err) {
    console.error("Error:", err);
    const escapedError = err.message.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
    const resultsDiv = document.getElementById("results");
    resultsDiv.hidden = false;
    resultsDiv.textContent += `\n\n❌ Error: ${escapedError}`;
    throw err;
  }
}

async function checkClipboardContent() {
  try {
    const { text } = await getClipboardContent();
    const clearButton = document.getElementById("clear-clipboard-container");
    clearButton.hidden = !text || text.trim() === "";
  } catch (err) {
    console.error("Error checking clipboard:", err);
  }
}

async function handleClearClipboardClick() {
  try {
    await clearClipboard();
    // Hide the clear button after clearing
    document.getElementById("clear-clipboard-container").hidden = true;
  } catch (err) {
    console.error("Error clearing clipboard:", err);
    showToast(`Failed to clear clipboard: ${err.message}`, "error");
  }
}

function closeThankYouPopup() {
  const popup = document.getElementById("thank-you-popup");
  popup.style.display = "none";
}

async function handleUSDCTransfer(amt, recipient) {
  try {
    // Call the atomic sendUSDC function from sdk-wallet.js
    const result = await window.sendUSDC(amt, recipient);

    if (result) {
      // Show thank you popup
      const popup = document.getElementById("thank-you-popup");
      popup.style.display = "flex";

      // Hide popup after 5 seconds
      setTimeout(closeThankYouPopup, 5000);
    } else {
      showToast("Did not send USDC", "info");
    }
  } catch (error) {
    console.error("USDC transfer failed:", error);
    showToast(`Failed to send USDC: ${error.message}`, "error");
  }
}

async function fetchProtectedResults() {
  const secureDiv = document.getElementById("secureDiv");
  const secureResults = document.getElementById("secureResults");

  try {
    secureDiv.hidden = false;
    secureResults.textContent = "Fetching protected results...";

    // this logic below does not throw an error if auth fails
    const response = await fetch("/api/protected/secret", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(inMemoryJwtDoNotPersist
          ? { Authorization: `Bearer ${inMemoryJwtDoNotPersist}` }
          : {}),
      },
    });

    const data = await response.json();

    // the message below is either a successful result, or an error message
    //
    // an alternative would be to offer the user a graceful chance to re-authorize,
    // which could occur after an inactivity timeout
    secureResults.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    secureResults.textContent = `Error: ${error.message}`;
  }
}

async function handleBookmarkClick() {
  try {
    const { text } = await getClipboardContent();
    if (!text || text.trim() === "") {
      throw new Error("No content in clipboard");
    }

    if (!inMemoryJwtDoNotPersist) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch("/api/protected/bookmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${inMemoryJwtDoNotPersist}`,
        },
        body: JSON.stringify({ hashOrUrl: text }),
      });

      const res = await response.json();
      if (!response.ok) {
        showToast(`Did not create bookmark: ${res.message}`, "info");
      } else {
        showToast(res.message, "success");
      }
    } catch (error) {
      throw new Error(error);
    }
  } catch (error) {
    showToast(`Failed to create bookmark: ${error.message}`, "error");
  }
}

function showModal() {
  const modal = document.getElementById("full-modal");
  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = document.getElementById("full-modal");
  modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
}

function showToast(message, type = "info", duration = 3000) {
  // Remove any existing toast
  const existingToast = document.querySelector(".toast");
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Add to DOM
  document.body.appendChild(toast);

  // Show toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Hide and remove toast after duration
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 300); // Wait for transition to complete
  }, duration);
}

// Close modal when clicking outside the content
document.addEventListener("click", (event) => {
  const modal = document.getElementById("full-modal");
  if (!modal.hasAttribute("hidden") && event.target === modal) {
    closeModal();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  handleAutomaticSignIn();
  checkClipboardContent();
  setInterval(checkClipboardContent, 2000);
});
