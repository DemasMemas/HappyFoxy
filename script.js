const revealItems = document.querySelectorAll(".reveal");
const form = document.querySelector("#lead-form");
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue;
      }

      const siblings = Array.from(entry.target.parentElement?.children || []);
      const index = Math.max(0, siblings.indexOf(entry.target));
      entry.target.style.transitionDelay = `${Math.min(index * 60, 360)}ms`;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  },
  { threshold: 0.16 }
);

revealItems.forEach((item) => observer.observe(item));

if (navToggle && siteNav) {
  const closeMenu = () => {
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
}

const carousel = document.querySelector("[data-carousel]");

if (carousel) {
  const track = carousel.querySelector(".review-carousel-track");
  const slides = Array.from(carousel.querySelectorAll(".review-slide"));
  const prevButton = carousel.querySelector("[data-carousel-prev]");
  const nextButton = carousel.querySelector("[data-carousel-next]");
  const dots = carousel.querySelector(".review-carousel-dots");

  slides.forEach((slide) => {
    const image = slide.querySelector("img");
    if (!image) {
      return;
    }

    image.addEventListener("load", () => slide.classList.add("has-image"));
    image.addEventListener("error", () => slide.classList.add("missing-image"));
  });

  let currentIndex = 0;

  const makeDot = (index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "review-carousel-dot";
    dot.setAttribute("aria-label", `Перейти к отзыву ${index + 1}`);
    dot.addEventListener("click", () => {
      currentIndex = index;
      render();
    });
    return dot;
  };

  const wrapIndex = (index) => {
    const total = slides.length;
    return (index + total) % total;
  };

  const render = () => {
    if (!track || !slides.length) {
      return;
    }

    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    Array.from(dots?.children || []).forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentIndex);
      dot.setAttribute("aria-current", index === currentIndex ? "true" : "false");
    });
  };

  if (dots) {
    dots.innerHTML = "";
    slides.forEach((_, index) => {
      dots.appendChild(makeDot(index));
    });
  }

  prevButton?.addEventListener("click", () => {
    currentIndex = wrapIndex(currentIndex - 1);
    render();
  });

  nextButton?.addEventListener("click", () => {
    currentIndex = wrapIndex(currentIndex + 1);
    render();
  });

  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      currentIndex = wrapIndex(currentIndex - 1);
      render();
    }

    if (event.key === "ArrowRight") {
      currentIndex = wrapIndex(currentIndex + 1);
      render();
    }
  });

  carousel.tabIndex = 0;
  render();
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      form.reportValidity();
      return;
    }

    const submitButton = form.querySelector(".button-submit");
    const status = form.querySelector("#form-status");
    const formData = new FormData(form);

    submitButton.disabled = true;
    submitButton.textContent = "Отправляем...";
    if (status) {
      status.textContent = "Отправляем заявку...";
      status.classList.remove("is-error", "is-success");
    }

    fetch(form.action, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Не удалось отправить заявку.");
        }
        return data;
      })
      .then(() => {
        form.reset();
        if (status) {
          status.textContent = "Заявка отправлена. Мы свяжемся с вами в ближайшее время.";
          status.classList.add("is-success");
        }
      })
      .catch((error) => {
        if (status) {
          status.textContent = error.message || "Не удалось отправить заявку. Позвоните нам, пожалуйста.";
          status.classList.add("is-error");
        }
      })
      .finally(() => {
        submitButton.disabled = false;
        submitButton.textContent = "Отправить заявку";
      });
  });
}
