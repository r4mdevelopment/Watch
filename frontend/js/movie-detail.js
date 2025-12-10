// TMDB API Configuration
const API_BASE_URL = "http://localhost:8000/api"
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

let selectedRating = 0
let currentMovieId = null
let currentUser = null
let isFavorite = false
let selectedPlayer = "vidplus"

// Fetch movie details from backend
async function fetchMovieDetails(movieId) {
  try {
    const response = await fetch(`${API_BASE_URL}/movies/${movieId}`)
    if (!response.ok) throw new Error("Failed to fetch movie details")
    const movie = await response.json()

    return {
      id: movie.id,
      title: movie.title,
      genre: movie.genres.map((g) => g.name).join(", "),
      rating: movie.vote_average.toFixed(1),
      image: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : "/placeholder.svg?height=450&width=300",
      description: movie.overview || "Описание отсутствует",
      releaseDate: movie.release_date,
      runtime: movie.runtime,
    }
  } catch (error) {
    console.error("Ошибка загрузки деталей фильма:", error)
    return null
  }
}

async function checkAuth() {
  const token = localStorage.getItem("token")
  if (!token) return null

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("Auth check failed:", error)
    return null
  }
}

async function checkIfFavorite(movieId) {
  const token = localStorage.getItem("token")
  if (!token) return false

  try {
    const response = await fetch(`${API_BASE_URL}/favorites`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) return false

    const favorites = await response.json()
    return favorites.some((fav) => fav.movie_id === Number.parseInt(movieId))
  } catch (error) {
    console.error("Error checking favorites:", error)
    return false
  }
}

async function addToWatchHistory(movieId) {
  const token = localStorage.getItem("token")
  if (!token) return

  try {
    await fetch(`${API_BASE_URL}/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ movie_id: Number.parseInt(movieId) }),
    })
  } catch (error) {
    console.error("Error adding to watch history:", error)
  }
}

async function toggleFavorite(movieId) {
  const token = localStorage.getItem("token")
  if (!token) {
    window.location.href = "login.html"
    return
  }

  try {
    if (isFavorite) {
      const response = await fetch(`${API_BASE_URL}/favorites/${movieId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        isFavorite = false
      }
    } else {
      const response = await fetch(`${API_BASE_URL}/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ movie_id: Number.parseInt(movieId) }),
      })

      if (response.ok) {
        isFavorite = true
      }
    }

    // Update button state
    updateFavoriteButton()
  } catch (error) {
    console.error("Error toggling favorite:", error)
  }
}

function updateFavoriteButton() {
  const favoriteBtn = document.querySelector(".favorite-btn")
  const icon = favoriteBtn.querySelector("svg")

  if (isFavorite) {
    favoriteBtn.classList.add("active")
    icon.setAttribute("fill", "currentColor")
  } else {
    favoriteBtn.classList.remove("active")
    icon.setAttribute("fill", "none")
  }
}

async function loadPlayer(movieId, player) {
  const moviePlayer = document.getElementById("moviePlayer")

  switch (player) {
    case "vidplus":
      const vidplusUrl = `https://player.vidplus.to/embed/movie/${movieId}?autoplay=false&poster=true&title=true&watchparty=false&chromecast=true&servericon=true&setting=true&pip=true&primarycolor=6C63FF&secondarycolor=9F9BFF&iconcolor=FFFFFF&logourl=https%3A%2F%2Fi.ibb.co%2F67wTJd9R%2Fpngimg-com-netflix-PNG11.png&font=Roboto&fontcolor=FFFFFF&fontsize=20&opacity=0.5`
      moviePlayer.src = vidplusUrl
      break

    case "bard":
      moviePlayer.src = `https://moviesapi.club/movie/${movieId}`
      break

    case "xayah":
      moviePlayer.src = `https://vidsrc-embed.ru/embed/movie?tmdb=${movieId}`
      break

    case "ekko":
      moviePlayer.src = `https://player.videasy.net/movie/${movieId}`
      break
  }
}

// Load movie details
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const movieId = urlParams.get("id")

  if (!movieId) {
    window.location.href = "movies.html"
    return
  }

  currentMovieId = movieId

  currentUser = await checkAuth()

  if (currentUser) {
    isFavorite = await checkIfFavorite(movieId)
    await addToWatchHistory(movieId)
  }

  // Show loading state
  document.getElementById("movieTitle").textContent = "Загрузка..."

  // Fetch movie details
  const movie = await fetchMovieDetails(movieId)

  if (!movie) {
    alert("Фильм не найден")
    window.location.href = "movies.html"
    return
  }

  // Set movie details
  document.getElementById("movieTitle").textContent = movie.title
  document.getElementById("movieGenre").textContent = movie.genre
  document.getElementById("movieRating").textContent = `★ ${movie.rating}`
  document.getElementById("movieDescription").textContent = movie.description
  document.getElementById("moviePoster").src = movie.image
  document.getElementById("moviePoster").alt = movie.title

  await loadPlayer(movieId, selectedPlayer)

  document.getElementById("playerSelect").addEventListener("change", async (e) => {
    selectedPlayer = e.target.value
    await loadPlayer(movieId, selectedPlayer)
  })

  updateFavoriteButton()

  // Load reviews
  await loadReviews(movieId)

  // Star rating input
  const starButtons = document.querySelectorAll(".star-btn")
  starButtons.forEach((btn) => {
    btn.addEventListener("mouseenter", function () {
      const rating = Number.parseInt(this.dataset.rating)
      starButtons.forEach((star, index) => {
        if (index < rating) {
          star.classList.add("hover")
        } else {
          star.classList.remove("hover")
        }
      })
    })

    btn.addEventListener("mouseleave", () => {
      starButtons.forEach((star) => {
        star.classList.remove("hover")
      })
    })

    btn.addEventListener("click", function () {
      if (!currentUser) {
        alert("Пожалуйста, войдите в систему для оценки фильма")
        window.location.href = "login.html"
        return
      }

      selectedRating = Number.parseInt(this.dataset.rating)
      starButtons.forEach((star, index) => {
        if (index < selectedRating) {
          star.classList.add("active")
        } else {
          star.classList.remove("active")
        }
      })
    })
  })

  // Submit review
  document.querySelector(".submit-review-btn").addEventListener("click", async () => {
    if (!currentUser) {
      window.location.href = "login.html"
      return
    }

    const reviewText = document.getElementById("reviewText").value.trim()

    if (!reviewText) {
      alert("Пожалуйста, напишите отзыв")
      return
    }

    if (selectedRating === 0) {
      alert("Пожалуйста, поставьте оценку")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE_URL}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          movie_id: Number.parseInt(currentMovieId),
          rating: selectedRating,
          comment: reviewText,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to submit review")
      }

      // Clear form
      document.getElementById("reviewText").value = ""
      selectedRating = 0
      starButtons.forEach((star) => star.classList.remove("active"))

      // Reload reviews
      await loadReviews(movieId)
    } catch (error) {
      console.error("Error submitting review:", error)
      alert(error.message || "Ошибка при отправке отзыва. Попробуйте еще раз.")
    }
  })

  document.querySelector(".favorite-btn").addEventListener("click", () => {
    toggleFavorite(currentMovieId)
  })
})

async function loadReviews(movieId) {
  const reviewsList = document.getElementById("reviewsList")

  try {
    const response = await fetch(`${API_BASE_URL}/reviews/${movieId}`)

    if (!response.ok) {
      throw new Error("Failed to load reviews")
    }

    const reviews = await response.json()

    if (reviews.length === 0) {
      reviewsList.innerHTML = '<p class="no-reviews">Пока нет отзывов. Будьте первым!</p>'
      return
    }

    reviewsList.innerHTML = reviews
      .map((review) => {
        const reviewDate = new Date(review.created_at)
        const formattedDate = reviewDate.toLocaleDateString("ru-RU", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        // XSS protection - escape HTML
        const safeComment = escapeHtml(review.comment)
        const safeUsername = escapeHtml(review.user.username)

        return `
        <div class="review-item">
            <div class="review-header">
                <div class="review-author">
                    <div class="author-avatar">
                        ${
                          review.user.avatar_url
                            ? `<img src="${review.user.avatar_url}" alt="${safeUsername}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`
                            : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>`
                        }
                    </div>
                    <div>
                        <h4 class="author-name">${safeUsername}</h4>
                        <p class="review-date">${formattedDate}</p>
                    </div>
                </div>
                <div class="review-rating">${"★".repeat(review.rating)}${"☆".repeat(10 - review.rating)}</div>
            </div>
            <p class="review-text">${safeComment}</p>
        </div>
    `
      })
      .join("")
  } catch (error) {
    console.error("Error loading reviews:", error)
    reviewsList.innerHTML = '<p class="error-message">Ошибка загрузки отзывов</p>'
  }
}

// XSS protection function
function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}
