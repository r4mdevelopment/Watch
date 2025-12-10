// TMDB API Configuration
//const API_BASE_URL = "http://localhost:8000/api"
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

let currentCategory = "all"
let currentPage = 1
let totalPages = 1
let allMovies = []
let searchTimeout = null
let isSearching = false

// Category mapping to TMDB genre IDs
const categoryToGenre = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
}

// Fetch popular movies from backend
async function fetchMovies(page = 1, category = "all") {
  try {
    let url = `${API_BASE_URL}/movies/popular?page=${page}`

    // If specific category is selected, fetch by genre
    if (category !== "all" && categoryToGenre[category]) {
      url = `${API_BASE_URL}/movies/genre/${categoryToGenre[category]}?page=${page}`
    }

    const response = await fetch(url)
    if (!response.ok) throw new Error("Failed to fetch movies")
    const data = await response.json()

    // Update pagination info
    totalPages = data.total_pages > 500 ? 500 : data.total_pages // TMDB limits to 500 pages
    currentPage = data.page

    allMovies = data.results.map((movie) => {
      let displayGenreId = movie.genre_ids[0]

      // If specific category is selected, try to find that genre in the movie's genres
      if (category !== "all" && categoryToGenre[category]) {
        const selectedGenreId = categoryToGenre[category]
        if (movie.genre_ids.includes(selectedGenreId)) {
          displayGenreId = selectedGenreId
        }
      }

      return {
        id: movie.id,
        title: movie.title,
        genre: getGenreName(displayGenreId),
        category: getCategoryFromGenreId(displayGenreId),
        rating: movie.vote_average.toFixed(1),
        image: movie.poster_path
          ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
          : "/placeholder.svg?height=450&width=300",
        overview: movie.overview,
        releaseDate: movie.release_date,
      }
    })

    return allMovies
  } catch (error) {
    console.error("Ошибка загрузки фильмов:", error)
    return []
  }
}

// Get genre name from genre ID
function getGenreName(genreId) {
  const genres = {
    28: "Боевик",
    12: "Приключения",
    16: "Мультфильм",
    35: "Комедия",
    80: "Криминал",
    99: "Документальный",
    18: "Драма",
    10751: "Семейный",
    14: "Фэнтези",
    36: "История",
    27: "Ужасы",
    10402: "Музыка",
    9648: "Детектив",
    10749: "Мелодрама",
    878: "Фантастика",
    10770: "Телефильм",
    53: "Триллер",
    10752: "Военный",
    37: "Вестерн",
  }
  return genres[genreId] || "Разное"
}

// Get category from genre ID
function getCategoryFromGenreId(genreId) {
  const genreToCategory = {
    28: "action",
    35: "comedy",
    18: "drama",
    27: "horror",
    878: "scifi",
    53: "thriller",
  }
  return genreToCategory[genreId] || "all"
}

// Render movies
function renderMovies(searchTerm = "") {
  const moviesGrid = document.getElementById("moviesGrid")
  if (!moviesGrid) return

  let filteredMovies = allMovies

  // Filter by search term
  if (searchTerm) {
    filteredMovies = filteredMovies.filter((movie) => movie.title.toLowerCase().includes(searchTerm.toLowerCase()))
  }

  if (filteredMovies.length === 0) {
    moviesGrid.innerHTML =
      '<p style="text-align: center; color: #888; grid-column: 1/-1; padding: 3rem;">Фильмы не найдены</p>'
    return
  }

  // Always show cards in grid format
  moviesGrid.style.display = "grid"
  moviesGrid.style.flexDirection = ""
  moviesGrid.style.gap = ""

  moviesGrid.innerHTML = filteredMovies
    .map((movie) => {
      const year = movie.releaseDate ? movie.releaseDate.split("-")[0] : "N/A"
      return `
        <a href="movie-detail.html?id=${movie.id}" class="movie-card">
            <img src="${movie.image}" alt="${movie.title}" loading="lazy">
            <div class="movie-info">
                <h4>${movie.title}</h4>
                <p class="movie-genre">${movie.genre} • ${year}</p>
                <div class="movie-rating">★ ${movie.rating}</div>
            </div>
        </a>
    `
    })
    .join("")

  // Render pagination if not searching
  if (!isSearching) {
    renderPagination()
  }
}

function renderPagination() {
  const paginationContainer = document.getElementById("pagination")
  if (!paginationContainer) return

  if (totalPages <= 1) {
    paginationContainer.innerHTML = ""
    return
  }

  let paginationHTML = ""

  // Previous button
  if (currentPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})">‹ Назад</button>`
  }

  // Page numbers
  const maxPagesToShow = 7
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
  const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)

  // Adjust startPage if we're near the end
  if (endPage - startPage < maxPagesToShow - 1) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1)
  }

  // First page
  if (startPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`
    if (startPage > 2) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`
    }
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? "active" : ""
    paginationHTML += `<button class="pagination-btn ${activeClass}" onclick="goToPage(${i})">${i}</button>`
  }

  // Last page
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`
    }
    paginationHTML += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`
  }

  // Next button
  if (currentPage < totalPages) {
    paginationHTML += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})">Вперед ›</button>`
  }

  paginationContainer.innerHTML = paginationHTML
}

async function goToPage(page) {
  if (page < 1 || page > totalPages || page === currentPage) return

  const moviesGrid = document.getElementById("moviesGrid")
  if (moviesGrid) {
    moviesGrid.innerHTML =
      '<p style="text-align: center; color: #888; grid-column: 1/-1; padding: 3rem;">Загрузка фильмов...</p>'
  }

  // Scroll to top of movies grid
  window.scrollTo({ top: 0, behavior: "smooth" })

  await fetchMovies(page, currentCategory)
  renderMovies()
}

async function searchMovies(query) {
  if (!query || query.trim().length < 2) {
    isSearching = false
    await fetchMovies(1, currentCategory)
    renderMovies("")
    hideSuggestions()
    return
  }

  isSearching = true

  try {
    const response = await fetch(`${API_BASE_URL}/movies/search?query=${encodeURIComponent(query)}`)
    if (!response.ok) throw new Error("Failed to search movies")
    const data = await response.json()

    const searchResults = data.results.map((movie) => ({
      id: movie.id,
      title: movie.title,
      genre: getGenreName(movie.genre_ids[0]),
      category: getCategoryFromGenreId(movie.genre_ids[0]),
      rating: movie.vote_average.toFixed(1),
      image: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : "/placeholder.svg?height=450&width=300",
      overview: movie.overview,
      releaseDate: movie.release_date,
    }))

    allMovies = searchResults

    // Hide pagination during search
    const paginationContainer = document.getElementById("pagination")
    if (paginationContainer) {
      paginationContainer.innerHTML = ""
    }

    renderMovies("")
    showSuggestions(searchResults.slice(0, 5))
  } catch (error) {
    console.error("Ошибка поиска фильмов:", error)
  }
}

// Functions for autocomplete suggestions
function showSuggestions(movies) {
  let suggestionsBox = document.getElementById("searchSuggestions")

  if (!suggestionsBox) {
    suggestionsBox = document.createElement("div")
    suggestionsBox.id = "searchSuggestions"
    suggestionsBox.className = "search-suggestions"
    document.querySelector(".search-container").appendChild(suggestionsBox)
  }

  if (movies.length === 0) {
    hideSuggestions()
    return
  }

  suggestionsBox.innerHTML = movies
    .map(
      (movie) => `
        <div class="suggestion-item" onclick="selectMovie(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">
            <img src="${movie.image}" alt="${movie.title}" onerror="this.src='/placeholder.svg?height=60&width=40'">
            <div class="suggestion-info">
                <div class="suggestion-title">${movie.title}</div>
                <div class="suggestion-meta">${movie.genre} • ★ ${movie.rating}</div>
            </div>
        </div>
    `,
    )
    .join("")

  suggestionsBox.style.display = "block"
}

function hideSuggestions() {
  const suggestionsBox = document.getElementById("searchSuggestions")
  if (suggestionsBox) {
    suggestionsBox.style.display = "none"
  }
}

function selectMovie(movieId, movieTitle) {
  window.location.href = `movie-detail.html?id=${movieId}`
}

// Event listeners for DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
  const categorySelect = document.getElementById("categorySelect")
  const movieSearch = document.getElementById("movieSearch")
  const moviesGrid = document.getElementById("moviesGrid")

  // Show loading state
  if (moviesGrid) {
    moviesGrid.innerHTML =
      '<p style="text-align: center; color: #888; grid-column: 1/-1; padding: 3rem;">Загрузка фильмов...</p>'
  }

  // Get category from URL
  const urlParams = new URLSearchParams(window.location.search)
  const categoryParam = urlParams.get("category")
  const searchParam = urlParams.get("search")

  if (categoryParam) {
    currentCategory = categoryParam
    if (categorySelect) {
      categorySelect.value = categoryParam
    }
  }

  // Fetch movies from backend
  await fetchMovies(1, currentCategory)

  if (searchParam) {
    if (movieSearch) {
      movieSearch.value = searchParam
    }
    await searchMovies(searchParam)
  } else {
    renderMovies()
  }

  // Category select change
  if (categorySelect) {
    categorySelect.addEventListener("change", async function () {
      currentCategory = this.value
      currentPage = 1
      isSearching = false

      if (movieSearch) {
        movieSearch.value = ""
      }

      if (moviesGrid) {
        moviesGrid.innerHTML =
          '<p style="text-align: center; color: #888; grid-column: 1/-1; padding: 3rem;">Загрузка фильмов...</p>'
      }

      await fetchMovies(1, currentCategory)
      renderMovies()
    })
  }

  // Search functionality with debounce and autocomplete
  if (movieSearch) {
    movieSearch.addEventListener("input", (e) => {
      const query = e.target.value.trim()

      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      searchTimeout = setTimeout(() => {
        if (query.length >= 2) {
          searchMovies(query)
        } else if (query.length === 0) {
          isSearching = false
          fetchMovies(1, currentCategory).then(() => renderMovies(""))
          hideSuggestions()
        }
      }, 300)
    })

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-container")) {
        hideSuggestions()
      }
    })

    movieSearch.addEventListener("focus", (e) => {
      const query = e.target.value.trim()
      if (query.length >= 2) {
        searchMovies(query)
      }
    })
  }
})
