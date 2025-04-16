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

    // Store token and user data in sessionStorage
    sessionStorage.setItem(`token-${insecureFid}`, data.token);

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
  const context = await frame.sdk.context;
  const insecureFid = context?.user?.fid;
  const token = sessionStorage.getItem(`token-${insecureFid}`);
  if (token) {
    try {
      const response = await fetch("/api/protected/signout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
      // Always remove token, even if API call fails
      sessionStorage.removeItem(`token-${insecureFid}`);
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

    const context = await frame.sdk.context;
    const insecureFid = context?.user?.fid;
    const token = sessionStorage.getItem(`token-${insecureFid}`);
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (token) {
      headers[Authorization] = `Bearer ${token}`;
    }

    // Call the API
    const response = await fetch(`/api/${encodeURIComponent(text)}`, {
      headers,
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
    alert(
      "Failed to clear clipboard. Please make sure clipboard access is allowed."
    );
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
      console.error("USDC transfer failed:", result);
      alert(`Failed to send USDC: ${result}`);
    }
  } catch (error) {
    console.error("USDC transfer failed:", error);
    alert(`Failed to send USDC: ${error.message}`);
  }
}

async function fetchProtectedResults() {
  const context = await frame.sdk.context;
  const insecureFid = context?.user?.fid;
  const token = sessionStorage.getItem(`token-${insecureFid}`);

  const secureDiv = document.getElementById("secureDiv");
  const secureResults = document.getElementById("secureResults");
  const bookmarkButton = document.getElementById("bookmark-button");

  try {
    secureDiv.hidden = false;
    secureResults.textContent = "Fetching protected results...";

    const response = await fetch("/api/protected/secret", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await response.json();
    secureResults.textContent = JSON.stringify(data, null, 2);

    // Show bookmark button if authenticated
    bookmarkButton.hidden = !token;
  } catch (error) {
    secureResults.textContent = `Error: ${error.message}`;
    bookmarkButton.hidden = true;
  }
}

async function handleBookmarkClick() {
  try {
    const { text } = await getClipboardContent();
    if (!text || text.trim() === "") {
      throw new Error("No content in clipboard");
    }

    const context = await frame.sdk.context;
    const insecureFid = context?.user?.fid;
    const token = sessionStorage.getItem(`token-${insecureFid}`);
    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch("/api/protected/bookmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hashOrUrl: text }),
      });

      const res = await response.json();
      if (!response.ok) {
        alert(`Failed to create bookmark: ${res.message}`);
      } else {
        alert(res.message);
      }
    } catch (error) {
      throw new Error(error);
    }
  } catch (error) {
    alert(`Failed to create bookmark: ${error.message}`);
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
