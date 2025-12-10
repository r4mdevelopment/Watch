const API_BASE_URL = "http://localhost:8000/api"

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token")

  if (!token) {
    // Redirect to login if not authenticated
    window.location.href = "login.html"
    return
  }

  try {
    // Load user profile
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error("Authentication failed")
    }

    const user = await response.json()

    // Update profile UI
    document.getElementById("profileName").textContent = user.display_name || user.username
    document.getElementById("profileEmail").textContent = user.email

    if (user.avatar_url) {
      document.getElementById("profileAvatar").src = user.avatar_url
      document.getElementById("profileAvatar").style.display = "block"
      document.getElementById("defaultAvatar").style.display = "none"
    }

    // Load favorites
    await loadFavorites(token)

    // Load watch history
    await loadWatchHistory(token)

    // Load user reviews
    await loadUserReviews(token, user.id)
  } catch (error) {
    console.error("Error loading profile:", error)
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    window.location.href = "login.html"
  }
})

async function loadFavorites(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/favorites`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) throw new Error("Failed to load favorites")

    const favorites = await response.json()
    const favoritesList = document.getElementById("favoritesList")

    if (favorites.length === 0) {
      favoritesList.innerHTML = '<p class="empty-message">У вас пока нет избранных фильмов</p>'
      return
    }

    const moviesPromises = favorites.map((fav) => fetch(`${API_BASE_URL}/movies/${fav.movie_id}`).then((r) => r.json()))
    const movies = await Promise.all(moviesPromises)

    favoritesList.innerHTML = movies
      .map(
        (movie) => `
        <a href="movie-detail.html?id=${movie.id}" class="movie-card">
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
            <div class="movie-info">
                <h4>${movie.title}</h4>
                <p class="movie-genre">${movie.genres && movie.genres[0] ? movie.genres[0].name : "Фильм"}</p>
                <div class="movie-rating">★ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</div>
            </div>
        </a>
    `,
      )
      .join("")
  } catch (error) {
    console.error("Error loading favorites:", error)
    document.getElementById("favoritesList").innerHTML = '<p class="error-message">Ошибка загрузки избранного</p>'
  }
}

async function loadWatchHistory(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/history`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) throw new Error("Failed to load watch history")

    const history = await response.json()
    const historyList = document.getElementById("historyList")

    if (history.length === 0) {
      historyList.innerHTML = '<p class="empty-message">История посещений пуста</p>'
      return
    }

    const moviesPromises = history.map((item) => fetch(`${API_BASE_URL}/movies/${item.movie_id}`).then((r) => r.json()))
    const movies = await Promise.all(moviesPromises)

    historyList.innerHTML = movies
      .map((movie) => {
        const year = movie.release_date ? movie.release_date.split("-")[0] : "N/A"
        return `
        <a href="movie-detail.html?id=${movie.id}" class="movie-card">
            <img src="https://image.tmdb.org/t/p/w300${movie.poster_path}" alt="${movie.title}">
            <div class="movie-info">
                <h4>${movie.title}</h4>
                <p class="movie-genre">${movie.genres && movie.genres[0] ? movie.genres[0].name : "Фильм"} • ${year}</p>
                <div class="movie-rating">★ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</div>
            </div>
        </a>
    `
      })
      .join("")
  } catch (error) {
    console.error("Error loading watch history:", error)
    document.getElementById("historyList").innerHTML = '<p class="error-message">Ошибка загрузки истории</p>'
  }
}

async function loadUserReviews(token, userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/reviews`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) throw new Error("Failed to load reviews")

    const reviews = await response.json()
    const userReviews = document.getElementById("userReviews")

    if (reviews.length === 0) {
      userReviews.innerHTML = '<p class="empty-message">Вы еще не оставили ни одного отзыва</p>'
      return
    }

    const moviesPromises = reviews.map((review) =>
      fetch(`${API_BASE_URL}/movies/${review.movie_id}`).then((r) => r.json()),
    )
    const movies = await Promise.all(moviesPromises)

    userReviews.innerHTML = reviews
      .map((review, index) => {
        const reviewDate = new Date(review.created_at)
        const formattedDate = reviewDate.toLocaleDateString("ru-RU", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        return `
        <div class="review-item" data-review-id="${review.id}">
            <div class="review-header">
                <div class="review-author">
                    <h4 class="movie-title-in-review">
                        <a href="movie-detail.html?id=${review.movie_id}">${movies[index].title}</a>
                    </h4>
                    <p class="review-date">${formattedDate}</p>
                </div>
                <div class="review-actions-container">
                    <div class="review-rating">${"★".repeat(review.rating)}${"☆".repeat(10 - review.rating)}</div>
                    <button class="delete-review-btn" onclick="deleteReview(${review.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Удалить
                    </button>
                </div>
            </div>
            <p class="review-text">${escapeHtml(review.comment)}</p>
        </div>
    `
      })
      .join("")
  } catch (error) {
    console.error("Error loading user reviews:", error)
    document.getElementById("userReviews").innerHTML = '<p class="error-message">Ошибка загрузки отзывов</p>'
  }
}

async function deleteReview(reviewId) {
  if (!confirm("Вы уверены, что хотите удалить этот отзыв?")) {
    return
  }

  const token = localStorage.getItem("token")

  try {
    const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to delete review")
    }

    // Remove review from DOM
    const reviewElement = document.querySelector(`[data-review-id="${reviewId}"]`)
    if (reviewElement) {
      reviewElement.remove()
    }

    // Check if there are no more reviews
    const reviewsContainer = document.getElementById("userReviews")
    if (reviewsContainer.children.length === 0) {
      reviewsContainer.innerHTML = '<p class="empty-message">Вы еще не оставили ни одного отзыва</p>'
    }
  } catch (error) {
    console.error("Error deleting review:", error)
    alert(error.message || "Ошибка при удалении отзыва")
  }
}

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
  window.location.href = "index.html"
}

function editProfile() {
  const modal = document.createElement("div")
  modal.className = "modal-overlay"
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Редактировать профиль</h2>
      <form id="editProfileForm">
        <div class="form-group">
          <label for="editDisplayName">Отображаемое имя</label>
          <input type="text" id="editDisplayName" value="${document.getElementById("profileName").textContent}" required>
          <small>Это имя будет отображаться в ваших отзывах и профиле</small>
        </div>
        <div class="form-group">
          <label for="editEmail">Email</label>
          <input type="email" id="editEmail" value="${document.getElementById("profileEmail").textContent}" disabled readonly>
          <small>Email нельзя изменить</small>
        </div>
        <div class="form-group">
          <label for="editPassword">Новый пароль (оставьте пустым, чтобы не менять)</label>
          <input type="password" id="editPassword" minlength="6">
        </div>
        <div class="modal-buttons">
          <button type="submit" class="btn-primary">Сохранить</button>
          <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
        </div>
      </form>
    </div>
  `

  document.body.appendChild(modal)

  document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
    e.preventDefault()

    const displayName = document.getElementById("editDisplayName").value
    const password = document.getElementById("editPassword").value

    const token = localStorage.getItem("token")

    try {
      const updateData = { display_name: displayName }
      if (password) {
        updateData.password = password
      }

      const response = await fetch(`${API_BASE_URL}/auth/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Ошибка обновления профиля")
      }

      const updatedUser = await response.json()

      // Update localStorage
      localStorage.setItem("user", JSON.stringify(updatedUser))

      // Update UI with display_name
      document.getElementById("profileName").textContent = updatedUser.display_name || updatedUser.username

      modal.remove()
      // Refresh page to show updated name
      location.reload()
    } catch (error) {
      console.error("Error updating profile:", error)
      alert(error.message || "Ошибка при обновлении профиля")
    }
  })
}
