// Car Fix Garage - Main Application JavaScript

class CarFixApp {
  constructor() {
    this.currentLang = localStorage.getItem('lang') || 'en';
    this.translations = {};
    this.services = null;
    this.selectedServices = new Set();
    this.selectedTime = null;

    this.init();
  }

  async init() {
    await this.loadTranslations();
    await this.loadServices();
    this.setupEventListeners();
    this.setMinDate();
    this.applyTranslations();
  }

  // Load translations
  async loadTranslations() {
    try {
      const [en, lv, ru] = await Promise.all([
        fetch('/locales/en.json').then(r => r.json()),
        fetch('/locales/lv.json').then(r => r.json()),
        fetch('/locales/ru.json').then(r => r.json())
      ]);
      this.translations = { en, lv, ru };
    } catch (error) {
      console.error('Error loading translations:', error);
    }
  }

  // Load services from API
  async loadServices() {
    try {
      const response = await fetch('/api/services');
      this.services = await response.json();
      this.renderServices();
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }

  // Get translation by key path
  t(key) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // Apply translations to all elements
  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    // Update language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
    });

    // Update document title
    document.title = `${this.t('site.title')} - ${this.t('site.tagline')}`;

    // Re-render services with new language
    if (this.services) {
      this.renderServices();
      this.updateBookingSummary();
    }
  }

  // Render services
  renderServices() {
    const grid = document.getElementById('servicesGrid');
    if (!grid || !this.services) return;

    grid.innerHTML = this.services.categories.map(category => `
      <div class="service-category">
        <div class="category-header" data-category="${category.id}">
          <div class="category-icon">
            ${this.getCategoryIcon(category.icon)}
          </div>
          <h3>${category.name[this.currentLang] || category.name.en}</h3>
          <svg class="category-toggle" viewBox="0 0 24 24">
            <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </div>
        <div class="category-services" id="services-${category.id}">
          ${category.services.map(service => this.renderServiceItem(service)).join('')}
        </div>
      </div>
    `).join('');

    // Expand first category by default
    const firstCategory = grid.querySelector('.category-services');
    if (firstCategory) {
      firstCategory.classList.add('show');
      firstCategory.previousElementSibling.querySelector('.category-toggle').classList.add('expanded');
    }

    // Re-check selected services
    this.selectedServices.forEach(id => {
      const checkbox = document.querySelector(`.service-checkbox[data-id="${id}"]`);
      if (checkbox) checkbox.classList.add('checked');
    });
  }

  // Render single service item
  renderServiceItem(service) {
    const isSelected = this.selectedServices.has(service.id);
    const priceDisplay = service.price !== null
      ? (service.price === 0
        ? `<span class="service-price free">${this.t('services.free')}</span>`
        : `<span class="service-price">€${service.price}</span>`)
      : `<span class="service-price quote">${service.priceNote?.[this.currentLang] || this.t('services.requestQuote')}</span>`;

    return `
      <div class="service-item" data-id="${service.id}">
        <div class="service-checkbox ${isSelected ? 'checked' : ''}" data-id="${service.id}"></div>
        <div class="service-info">
          <div class="service-name">${service.name[this.currentLang] || service.name.en}</div>
          <div class="service-duration">${service.duration}</div>
        </div>
        ${priceDisplay}
      </div>
    `;
  }

  // Get category icon SVG
  getCategoryIcon(icon) {
    const icons = {
      engine: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>',
      brakes: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>',
      electrical: '<svg viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>',
      tyres: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-12.5c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 5.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>',
      exhaust: '<svg viewBox="0 0 24 24"><path d="M8.5 14.5L4 19l1.5 1.5L9 17h2l-2.5-2.5zM15 1c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 20.01L18 24l-2.99-3.01V19.5l-7.1-7.09c-.31.05-.61.09-.91.09-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 .3-.04.6-.09.91l2.58 2.58c.74-.77 1.76-1.26 2.9-1.32.63-.04.97-.6.75-1.16-.23-.59-.99-.77-1.51-.38-.26.2-.6.32-.95.32-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5c.32 0 .62.1.87.28.52.37 1.27.17 1.52-.4.23-.51.02-1.13-.49-1.4-.93-.5-2.03-.54-2.98-.16-.95.39-1.67 1.13-2.02 2.09-.31.85-.48 1.74-.48 2.63v1.92l7.1 7.1h1.49z"/></svg>',
      general: '<svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
      logistics: '<svg viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>'
    };
    return icons[icon] || icons.general;
  }

  // Setup event listeners
  setupEventListeners() {
    // Language selector
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentLang = btn.dataset.lang;
        localStorage.setItem('lang', this.currentLang);
        this.applyTranslations();
      });
    });

    // Mobile menu
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      document.getElementById('mainNav')?.classList.toggle('show');
    });

    // Category toggles (delegated)
    document.getElementById('servicesGrid')?.addEventListener('click', (e) => {
      const header = e.target.closest('.category-header');
      if (header) {
        const categoryId = header.dataset.category;
        const services = document.getElementById(`services-${categoryId}`);
        const toggle = header.querySelector('.category-toggle');

        services?.classList.toggle('show');
        toggle?.classList.toggle('expanded');
      }

      // Service selection
      const checkbox = e.target.closest('.service-checkbox');
      if (checkbox) {
        const serviceId = checkbox.dataset.id;
        this.toggleService(serviceId, checkbox);
      }
    });

    // Time slots
    document.getElementById('timeSlots')?.addEventListener('click', (e) => {
      const slot = e.target.closest('.time-slot');
      if (slot) {
        document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
        slot.classList.add('selected');
        this.selectedTime = slot.dataset.time;
        document.getElementById('appointmentTime').value = this.selectedTime;
      }
    });

    // Form submission
    document.getElementById('bookingForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitBooking();
    });

    // Close mobile menu on nav click
    document.querySelectorAll('#mainNav a').forEach(link => {
      link.addEventListener('click', () => {
        document.getElementById('mainNav')?.classList.remove('show');
      });
    });
  }

  // Toggle service selection
  toggleService(serviceId, checkbox) {
    if (this.selectedServices.has(serviceId)) {
      this.selectedServices.delete(serviceId);
      checkbox.classList.remove('checked');
    } else {
      this.selectedServices.add(serviceId);
      checkbox.classList.add('checked');
    }
    this.updateBookingSummary();
  }

  // Update booking summary
  updateBookingSummary() {
    const list = document.getElementById('selectedServicesList');
    const totalEl = document.getElementById('totalPrice');
    const submitBtn = document.getElementById('submitBtn');

    if (!list || !this.services) return;

    let total = 0;
    let hasQuoteOnly = false;
    const items = [];

    this.selectedServices.forEach(serviceId => {
      for (const category of this.services.categories) {
        const service = category.services.find(s => s.id === serviceId);
        if (service) {
          if (service.price !== null) {
            total += service.price;
            items.push({
              name: service.name[this.currentLang] || service.name.en,
              price: service.price
            });
          } else {
            hasQuoteOnly = true;
            items.push({
              name: service.name[this.currentLang] || service.name.en,
              price: null
            });
          }
          break;
        }
      }
    });

    if (items.length === 0) {
      list.innerHTML = `<p class="no-services-message" data-i18n="booking.noServices">${this.t('booking.noServices')}</p>`;
    } else {
      list.innerHTML = items.map(item => `
        <div class="selected-service-item">
          <span>${item.name}</span>
          <span>${item.price !== null ? `€${item.price}` : this.t('services.requestQuote')}</span>
        </div>
      `).join('');
    }

    totalEl.textContent = total;

    // Update submit button text based on whether we need quote or payment
    const submitSpan = submitBtn?.querySelector('span');
    if (submitSpan) {
      if (hasQuoteOnly && total === 0) {
        submitSpan.textContent = this.t('booking.submitQuote');
      } else {
        submitSpan.textContent = this.t('booking.submit');
      }
    }
  }

  // Set minimum date for appointment
  setMinDate() {
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split('T')[0];
    }
  }

  // Validate form
  validateForm() {
    const errors = [];

    if (this.selectedServices.size === 0) {
      errors.push(this.t('errors.selectService'));
    }

    const name = document.getElementById('customerName')?.value.trim();
    const email = document.getElementById('customerEmail')?.value.trim();
    const phone = document.getElementById('customerPhone')?.value.trim();
    const date = document.getElementById('appointmentDate')?.value;

    if (!name) errors.push(this.t('errors.required'));
    if (!email || !this.isValidEmail(email)) errors.push(this.t('errors.invalidEmail'));
    if (!phone) errors.push(this.t('errors.invalidPhone'));
    if (!date) errors.push(this.t('errors.selectDate'));
    if (!this.selectedTime) errors.push(this.t('errors.selectTime'));

    return errors;
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Submit booking
  async submitBooking() {
    const errors = this.validateForm();

    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.classList.add('loading');
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';

    // Check if any selected service requires quote only
    let hasQuoteOnly = false;
    this.selectedServices.forEach(serviceId => {
      for (const category of this.services.categories) {
        const service = category.services.find(s => s.id === serviceId);
        if (service && service.price === null) {
          hasQuoteOnly = true;
          break;
        }
      }
    });

    // Calculate total
    let total = 0;
    this.selectedServices.forEach(serviceId => {
      for (const category of this.services.categories) {
        const service = category.services.find(s => s.id === serviceId);
        if (service && service.price !== null) {
          total += service.price;
        }
      }
    });

    const bookingData = {
      customerName: document.getElementById('customerName').value.trim(),
      customerEmail: document.getElementById('customerEmail').value.trim(),
      customerPhone: document.getElementById('customerPhone').value.trim(),
      vehicleMake: document.getElementById('vehicleMake').value.trim(),
      vehicleModel: document.getElementById('vehicleModel').value.trim(),
      vehicleYear: document.getElementById('vehicleYear').value.trim(),
      vehicleRegistration: document.getElementById('vehicleRegistration').value.trim(),
      services: Array.from(this.selectedServices),
      notes: document.getElementById('notes').value.trim(),
      appointmentDate: document.getElementById('appointmentDate').value,
      appointmentTime: this.selectedTime,
      language: this.currentLang
    };

    try {
      // If quote only (no priced services), submit quote request
      if (hasQuoteOnly && total === 0) {
        const response = await fetch('/api/quote-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (response.ok) {
          alert('Quote request submitted! We will contact you shortly.');
          window.location.href = '/';
        } else {
          throw new Error(result.error || 'Failed to submit quote request');
        }
      } else {
        // Regular booking with payment
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (response.ok && result.checkoutUrl) {
          // Redirect to Stripe checkout
          window.location.href = result.checkoutUrl;
        } else {
          throw new Error(result.error || 'Failed to create booking');
        }
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert(this.t('errors.bookingFailed'));
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.innerHTML = `<span data-i18n="booking.submit">${this.t('booking.submit')}</span>`;
    }
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.carFixApp = new CarFixApp();
});
