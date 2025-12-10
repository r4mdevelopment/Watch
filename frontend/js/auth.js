// Authentication helper functions
const API_BASE_URL = "http://localhost:8000/api"

// Check if user is logged in
function isLoggedIn() {
  return localStorage.getItem("token") !== null
}

// Get current user
function getCurrentUser() {
  const userStr = localStorage.getItem("user")
  return userStr ? JSON.parse(userStr) : null
}

// Save auth data
function saveAuthData(token, user) {
  localStorage.setItem("token", token)
  localStorage.setItem("user", JSON.stringify(user))
}

// Clear auth data
function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
  window.location.href = "index.html"
}

// Get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

// Login form
const loginForm = document.getElementById("loginForm")
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const username = document.getElementById("username").value
    const password = document.getElementById("password").value
    const errorMessage = document.getElementById("errorMessage")

    errorMessage.style.display = "none"
    errorMessage.textContent = ""

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        errorMessage.textContent = data.detail || "Ошибка входа"
        errorMessage.style.display = "block"
        return
      }

      saveAuthData(data.access_token, data.user)
      window.location.href = "profile.html"
    } catch (error) {
      errorMessage.textContent = "Ошибка подключения к серверу"
      errorMessage.style.display = "block"
      console.error("Login error:", error)
    }
  })
}

// Register form
const registerForm = document.getElementById("registerForm")
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const username = document.getElementById("username").value
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value
    const confirmPassword = document.getElementById("confirmPassword").value
    const errorMessage = document.getElementById("errorMessage")

    errorMessage.style.display = "none"
    errorMessage.textContent = ""

    // Validate passwords match
    if (password !== confirmPassword) {
      errorMessage.textContent = "Пароли не совпадают"
      errorMessage.style.display = "block"
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        errorMessage.textContent = data.detail || "Ошибка регистрации"
        errorMessage.style.display = "block"
        return
      }

      saveAuthData(data.access_token, data.user)
      window.location.href = "profile.html"
    } catch (error) {
      errorMessage.textContent = "Ошибка подключения к серверу"
      errorMessage.style.display = "block"
      console.error("Register error:", error)
    }
  })
}

// Update profile button in header
document.addEventListener("DOMContentLoaded", () => {
  const profileLinks = document.querySelectorAll('a[href="profile.html"]')

  profileLinks.forEach((link) => {
    if (!isLoggedIn()) {
      link.href = "login.html"
    }
  })
})
