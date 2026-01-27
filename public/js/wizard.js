// Car Fix Garage - Guided Wizard Experience

class CarFixWizard {
  constructor() {
    this.currentStep = 1;
    this.currentLang = localStorage.getItem('lang') || 'en';
    this.translations = {};
    this.services = null;
    this.selectedReason = null;
    this.selectedArea = null;
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
      const text = this.t(key);
      if (text !== key) el.textContent = text;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = this.t(key);
      if (text !== key) el.placeholder = text;
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
    });
  }

  // Setup event listeners
  setupEventListeners() {
    // Language selector
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentLang = btn.dataset.lang;
        localStorage.setItem('lang', this.currentLang);
        this.applyTranslations();
        // Re-render current step if needed
        if (this.currentStep === 2) this.renderStep2();
        if (this.currentStep === 3) this.renderStep3();
      });
    });

    // Step 1: Reason cards
    document.querySelectorAll('#step1 .option-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedReason = card.dataset.reason;
        document.querySelectorAll('#step1 .option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        setTimeout(() => {
          this.goToStep(2);
        }, 200);
      });
    });

    // Step 2: Area selection (delegated)
    document.getElementById('areaOptions')?.addEventListener('click', (e) => {
      const card = e.target.closest('.option-card');
      if (card) {
        this.selectedArea = card.dataset.area;
        document.querySelectorAll('#step2 .option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        setTimeout(() => {
          this.goToStep(3);
        }, 200);
      }
    });

    // Step 3: Service selection (delegated)
    document.getElementById('symptomList')?.addEventListener('click', (e) => {
      const item = e.target.closest('.symptom-item');
      if (item) {
        const serviceId = item.dataset.id;
        if (this.selectedServices.has(serviceId)) {
          this.selectedServices.delete(serviceId);
          item.classList.remove('selected');
        } else {
          this.selectedServices.add(serviceId);
          item.classList.add('selected');
        }
        this.updateSummary();
      }
    });

    // Continue to step 4
    document.getElementById('toStep4Btn')?.addEventListener('click', () => {
      this.goToStep(4);
    });

    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetStep = parseInt(btn.dataset.back);
        this.goToStep(targetStep);
      });
    });

    // Time pills
    document.querySelectorAll('.time-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.time-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        this.selectedTime = pill.dataset.time;
        document.getElementById('appointmentTime').value = this.selectedTime;
      });
    });

    // Extra services (pickup/delivery)
    document.getElementById('pickupService')?.addEventListener('change', () => this.updateOrderTotal());
    document.getElementById('deliveryService')?.addEventListener('change', () => this.updateOrderTotal());

    // Form submission
    document.getElementById('bookingForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitBooking();
    });
  }

  // Navigate to step
  goToStep(step) {
    // Hide current step
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));

    // Show target step
    document.getElementById(`step${step}`).classList.add('active');

    // Update progress bar
    document.querySelectorAll('.progress-step').forEach(s => {
      const stepNum = parseInt(s.dataset.step);
      s.classList.toggle('active', stepNum <= step);
      s.classList.toggle('completed', stepNum < step);
    });

    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = `${((step - 1) / 3) * 100}%`;

    this.currentStep = step;

    // Render step content
    if (step === 2) this.renderStep2();
    if (step === 3) this.renderStep3();
    if (step === 4) this.renderStep4();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Render Step 2 based on reason selection
  renderStep2() {
    const container = document.getElementById('areaOptions');
    let areas = [];

    if (this.selectedReason === 'broken') {
      areas = [
        { id: 'engine', icon: 'engine', name: this.t('wizard.areas.engine'), desc: this.t('wizard.areas.engineDesc') },
        { id: 'brakes', icon: 'brakes', name: this.t('wizard.areas.brakes'), desc: this.t('wizard.areas.brakesDesc') },
        { id: 'electrical', icon: 'electrical', name: this.t('wizard.areas.electrical'), desc: this.t('wizard.areas.electricalDesc') },
        { id: 'exhaust', icon: 'exhaust', name: this.t('wizard.areas.exhaust'), desc: this.t('wizard.areas.exhaustDesc') },
        { id: 'other', icon: 'other', name: this.t('wizard.areas.other'), desc: this.t('wizard.areas.otherDesc') }
      ];
    } else if (this.selectedReason === 'maintenance') {
      areas = [
        { id: 'oil-service', icon: 'engine', name: this.t('wizard.areas.oilService'), desc: this.t('wizard.areas.oilServiceDesc') },
        { id: 'brake-service', icon: 'brakes', name: this.t('wizard.areas.brakeService'), desc: this.t('wizard.areas.brakeServiceDesc') },
        { id: 'ac-service', icon: 'ac', name: this.t('wizard.areas.acService'), desc: this.t('wizard.areas.acServiceDesc') },
        { id: 'full-service', icon: 'full', name: this.t('wizard.areas.fullService'), desc: this.t('wizard.areas.fullServiceDesc') }
      ];
    } else if (this.selectedReason === 'tyres') {
      areas = [
        { id: 'tyre-change', icon: 'tyres', name: this.t('wizard.areas.tyreChange'), desc: this.t('wizard.areas.tyreChangeDesc') },
        { id: 'tyre-repair', icon: 'repair', name: this.t('wizard.areas.tyreRepair'), desc: this.t('wizard.areas.tyreRepairDesc') },
        { id: 'wheel-service', icon: 'wheel', name: this.t('wizard.areas.wheelService'), desc: this.t('wizard.areas.wheelServiceDesc') }
      ];
    } else if (this.selectedReason === 'inspection') {
      areas = [
        { id: 'pre-purchase', icon: 'inspect', name: this.t('wizard.areas.prePurchase'), desc: this.t('wizard.areas.prePurchaseDesc') },
        { id: 'full-inspection', icon: 'full', name: this.t('wizard.areas.fullInspection'), desc: this.t('wizard.areas.fullInspectionDesc') }
      ];
    }

    container.innerHTML = areas.map(area => `
      <div class="option-card" data-area="${area.id}">
        <div class="option-icon ${area.icon}">
          ${this.getAreaIcon(area.icon)}
        </div>
        <h3>${area.name}</h3>
        <p>${area.desc}</p>
      </div>
    `).join('');
  }

  // Render Step 3 based on area selection
  renderStep3() {
    const container = document.getElementById('symptomList');
    const title = document.getElementById('step3Title');
    let services = [];

    // Map area selections to actual services
    const serviceMap = {
      // Broken - Engine
      'engine': ['engine-diagnostics', 'oil-change', 'spark-plugs', 'coolant-flush', 'timing-belt', 'engine-repair'],
      // Broken - Brakes
      'brakes': ['brake-pads', 'brake-discs', 'brake-fluid', 'suspension-check', 'shock-absorbers'],
      // Broken - Electrical
      'electrical': ['electrical-diagnostics', 'battery-replacement', 'alternator-repair', 'starter-motor', 'lighting-repair'],
      // Broken - Exhaust
      'exhaust': ['exhaust-repair', 'catalytic-converter', 'emissions-testing'],
      // Broken - Other
      'other': ['full-inspection', 'ac-service', 'wiper-replacement'],
      // Maintenance
      'oil-service': ['oil-change', 'coolant-flush', 'spark-plugs'],
      'brake-service': ['brake-pads', 'brake-fluid', 'brake-discs'],
      'ac-service': ['ac-service'],
      'full-service': ['oil-change', 'brake-fluid', 'coolant-flush', 'full-inspection', 'wiper-replacement'],
      // Tyres
      'tyre-change': ['tyre-change-seasonal'],
      'tyre-repair': ['tyre-repair', 'tyre-pressure'],
      'wheel-service': ['wheel-balancing', 'wheel-alignment'],
      // Inspection
      'pre-purchase': ['pre-purchase'],
      'full-inspection': ['full-inspection']
    };

    const serviceIds = serviceMap[this.selectedArea] || [];

    // Get service details from loaded services
    if (this.services) {
      for (const category of this.services.categories) {
        for (const service of category.services) {
          if (serviceIds.includes(service.id)) {
            services.push(service);
          }
        }
      }
    }

    // Update title based on context
    if (this.selectedReason === 'broken') {
      title.textContent = this.t('wizard.step3.titleBroken') || "What's happening?";
    } else {
      title.textContent = this.t('wizard.step3.titleSelect') || "Select services";
    }

    container.innerHTML = services.map(service => {
      const isSelected = this.selectedServices.has(service.id);
      const priceText = service.price !== null
        ? (service.price === 0 ? this.t('services.free') : `€${service.price}`)
        : this.t('services.requestQuote');

      return `
        <div class="symptom-item ${isSelected ? 'selected' : ''}" data-id="${service.id}" data-price="${service.price || 0}">
          <div class="symptom-check">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <div class="symptom-info">
            <span class="symptom-name">${service.name[this.currentLang] || service.name.en}</span>
            <span class="symptom-duration">${service.duration}</span>
          </div>
          <span class="symptom-price ${service.price === null ? 'quote' : ''}">${priceText}</span>
        </div>
      `;
    }).join('');

    this.updateSummary();
  }

  // Update summary in step 3
  updateSummary() {
    const summaryItems = document.getElementById('summaryItems');
    const summaryTotal = document.getElementById('summaryTotal');
    const continueBtn = document.getElementById('toStep4Btn');

    let total = 0;
    const items = [];

    this.selectedServices.forEach(serviceId => {
      if (this.services) {
        for (const category of this.services.categories) {
          const service = category.services.find(s => s.id === serviceId);
          if (service) {
            if (service.price !== null) total += service.price;
            items.push({
              name: service.name[this.currentLang] || service.name.en,
              price: service.price
            });
            break;
          }
        }
      }
    });

    summaryItems.innerHTML = items.map(item => `
      <div class="summary-item">
        <span>${item.name}</span>
        <span>${item.price !== null ? `€${item.price}` : '—'}</span>
      </div>
    `).join('');

    summaryTotal.textContent = total;
    continueBtn.disabled = this.selectedServices.size === 0;

    // Show/hide summary
    document.getElementById('selectedSummary').classList.toggle('has-items', items.length > 0);
  }

  // Render Step 4
  renderStep4() {
    this.updateOrderTotal();
  }

  // Update order total in step 4
  updateOrderTotal() {
    const orderItems = document.getElementById('orderItems');
    const orderTotal = document.getElementById('orderTotal');

    let total = 0;
    const items = [];

    this.selectedServices.forEach(serviceId => {
      if (this.services) {
        for (const category of this.services.categories) {
          const service = category.services.find(s => s.id === serviceId);
          if (service) {
            if (service.price !== null) total += service.price;
            items.push({
              id: service.id,
              name: service.name[this.currentLang] || service.name.en,
              price: service.price
            });
            break;
          }
        }
      }
    });

    // Add pickup/delivery
    if (document.getElementById('pickupService')?.checked) {
      total += 25;
      items.push({ id: 'car-pickup', name: this.t('wizard.step4.pickup').replace(' (+€25)', ''), price: 25 });
      this.selectedServices.add('car-pickup');
    } else {
      this.selectedServices.delete('car-pickup');
    }

    if (document.getElementById('deliveryService')?.checked) {
      total += 25;
      items.push({ id: 'car-delivery', name: this.t('wizard.step4.delivery').replace(' (+€25)', ''), price: 25 });
      this.selectedServices.add('car-delivery');
    } else {
      this.selectedServices.delete('car-delivery');
    }

    orderItems.innerHTML = items.map(item => `
      <div class="order-item">
        <span>${item.name}</span>
        <span>${item.price !== null ? `€${item.price}` : this.t('services.requestQuote')}</span>
      </div>
    `).join('');

    orderTotal.textContent = total;
  }

  // Set minimum date
  setMinDate() {
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split('T')[0];
    }
  }

  // Get area icon SVG
  getAreaIcon(icon) {
    const icons = {
      engine: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4v2h3v2H7l-2 2v3H3v-3H1v8h2v-3h2v3h3l2 2h8v-4h2v2h2v-6h-2v2h-2V9h-5V7h3V4H7z"/></svg>',
      brakes: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>',
      electrical: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66l.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>',
      exhaust: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.5 2C9.64 2 7.21 3.98 6.63 6.64L4 10h3v7H3v3h18v-3h-4v-7h3l-2.63-3.36C16.79 3.98 14.36 2 11.5 2z"/></svg>',
      tyres: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-12.5c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 5.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>',
      ac: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z"/></svg>',
      full: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>',
      repair: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
      wheel: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><circle fill="currentColor" cx="12" cy="12" r="3"/></svg>',
      inspect: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
      other: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>'
    };
    return icons[icon] || icons.other;
  }

  // Validate form
  validateForm() {
    const errors = [];

    if (this.selectedServices.size === 0) {
      errors.push('Please select at least one service');
    }

    const name = document.getElementById('customerName')?.value.trim();
    const email = document.getElementById('customerEmail')?.value.trim();
    const phone = document.getElementById('customerPhone')?.value.trim();
    const date = document.getElementById('appointmentDate')?.value;

    if (!name) errors.push('Please enter your name');
    if (!email || !this.isValidEmail(email)) errors.push('Please enter a valid email');
    if (!phone) errors.push('Please enter your phone number');
    if (!date) errors.push('Please select a date');
    if (!this.selectedTime) errors.push('Please select a time');

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

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.classList.add('loading');
    checkoutBtn.innerHTML = '<span class="spinner"></span> Processing...';

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
      // Check if we need a quote (has services with no price)
      let hasQuoteOnly = false;
      let total = 0;

      this.selectedServices.forEach(serviceId => {
        if (this.services) {
          for (const category of this.services.categories) {
            const service = category.services.find(s => s.id === serviceId);
            if (service) {
              if (service.price === null) hasQuoteOnly = true;
              else if (service.price) total += service.price;
              break;
            }
          }
        }
      });

      if (hasQuoteOnly && total === 0) {
        // Quote request
        const response = await fetch('/api/quote-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });

        if (response.ok) {
          alert('Quote request submitted! We will contact you shortly.');
          window.location.href = '/';
        } else {
          throw new Error('Failed to submit quote request');
        }
      } else {
        // Payment booking
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (response.ok && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          throw new Error(result.error || 'Failed to create booking');
        }
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Something went wrong. Please try again or call us directly.');
    } finally {
      checkoutBtn.classList.remove('loading');
      checkoutBtn.innerHTML = `<span>${this.t('wizard.step4.checkout')}</span><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>`;
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.carFixWizard = new CarFixWizard();
});
