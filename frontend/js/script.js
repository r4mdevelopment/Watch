// Dropdown functionality
document.addEventListener("DOMContentLoaded", () => {
  const categoriesBtn = document.getElementById("categoriesBtn")
  const categoriesMenu = document.getElementById("categoriesMenu")

  if (categoriesBtn && categoriesMenu) {
    categoriesBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      categoriesMenu.classList.toggle("active")
    })

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!categoriesBtn.contains(e.target) && !categoriesMenu.contains(e.target)) {
        categoriesMenu.classList.remove("active")
      }
    })
  }
})

// Smooth scroll to about section
function scrollToAbout() {
  const aboutSection = document.getElementById("about")
  if (aboutSection) {
    aboutSection.scrollIntoView({ behavior: "smooth" })
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const moviesGrid = document.querySelector(".featured .movies-grid")

  if (moviesGrid) {
    try {
      const response = await fetch("http://localhost:8000/api/movies/popular?page=1")
      const data = await response.json()

      if (data.results && data.results.length > 0) {
        // Take first 6 movies sorted by rating
        const movies = data.results.sort((a, b) => b.vote_average - a.vote_average).slice(0, 6)

        moviesGrid.innerHTML = movies
          .map((movie) => {
            const year = movie.release_date ? movie.release_date.split("-")[0] : "N/A"
            return `
          <a href="movie-detail.html?id=${movie.id}" class="movie-card">
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
            <div class="movie-info">
              <h4>${movie.title}</h4>
              <p class="movie-genre">${getGenreName(movie.genre_ids[0])} • ${year}</p>
              <div class="movie-rating">★ ${movie.vote_average.toFixed(1)}</div>
            </div>
          </a>
        `
          })
          .join("")
      }
    } catch (error) {
      console.error("Error loading popular movies:", error)
    }
  }
})

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
  return genres[genreId] || "Фильм"
}

// Search functionality
const searchInputs = document.querySelectorAll(".search-input")
searchInputs.forEach((input) => {
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const searchTerm = e.target.value.trim()
      if (searchTerm) {
        // Check if we're on movies.html
        if (window.location.pathname.includes("movies.html")) {
          // Search on current page using movies.js searchMovies function
          window.searchMovies =
            window.searchMovies ||
            (() => {}) // Declare searchMovies if it's not already declared // Declare searchMovies if it's not already declared
          if (typeof window.searchMovies === "function") {
            window.searchMovies(searchTerm)
          }
        } else {
          // Redirect to movies.html with search query
          window.location.href = `movies.html?search=${encodeURIComponent(searchTerm)}`
        }
      }
    }
  })
})
