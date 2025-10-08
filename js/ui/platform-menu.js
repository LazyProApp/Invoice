/**
 * PlatformMenuHandler Module
 * Platform selection menu management
 */

import { EVENTS } from '../core/events.js';

export class PlatformMenuHandler {
  constructor(eventBus, dialogManager, dataEngine) {
    this.eventBus = eventBus;
    this.dialogManager = dialogManager;
    this.dataEngine = dataEngine;
    this.platformBtn = null;
    this.platformMenu = null;
    this.currentPlatform = null;
    this.previewSection = null;
    this.observer = null;

    this.initialize();
  }

  initialize() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupElements());
    } else {
      this.setupElements();
    }
  }

  setupElements() {
    this.platformBtn = document.getElementById('platformBtn');
    this.platformMenu = document.getElementById('platformMenu');
    this.currentPlatform = document.getElementById('currentPlatform');
    this.previewSection = document.getElementById('previewSection');

    if (this.platformBtn && this.platformMenu) {
      this.setupEventListeners();
    } else {
    }
  }

  setupEventListeners() {
    this.platformBtn.addEventListener('click', () => {
      this.handlePlatformButtonClick();
    });

    this.platformMenu.addEventListener('close', () => this.removeBlurEffect());
    this.platformMenu.addEventListener('closed', () => this.removeBlurEffect());

    this.setupMenuObserver();

    document.addEventListener('click', (event) => {
      this.handleOutsideClick(event);
    });

    this.platformMenu.addEventListener('click', (event) => {
      this.handleMenuItemClick(event);
    });

  }

  handlePlatformButtonClick() {
    if (this.platformMenu) {
      const wasOpen = this.platformMenu.open;
      this.platformMenu.open = !wasOpen;

      if (this.platformMenu.open && this.previewSection) {
        this.previewSection.classList.add('menu-blur');
      } else {
        this.removeBlurEffect();
      }
    }
  }

  setupMenuObserver() {
    if (this.platformMenu && window.MutationObserver) {
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'open'
          ) {
            if (!this.platformMenu.open) {
              this.removeBlurEffect();
            }
          }
        });
      });
      this.observer.observe(this.platformMenu, { attributes: true });
    }
  }

  handleOutsideClick(event) {
    if (this.platformMenu && this.platformMenu.open) {
      const isClickInsideMenu = this.platformMenu.contains(event.target);
      const isClickOnButton = this.platformBtn.contains(event.target);

      if (!isClickInsideMenu && !isClickOnButton) {
        this.platformMenu.open = false;
        this.removeBlurEffect();
      }
    }
  }

  async handleMenuItemClick(event) {
    const menuItem = event.target.closest('md-menu-item');
    if (!menuItem) return;

    const provider = menuItem.getAttribute('data-provider');
    const providerName =
      menuItem.querySelector('[slot="headline"]')?.textContent;

    const hasData = this.checkHasInvoiceData();

    if (hasData) {
      const confirmed = await this.showPlatformSwitchConfirmation();

      if (!confirmed) {
        this.platformMenu.open = false;
        return;
      }

      this.eventBus.emit(EVENTS.COMMAND.CLEAR_DATA_FOR_PLATFORM_SWITCH, {
        reason: 'platform_switch',
        newPlatform: provider
      });
    }

    if (this.currentPlatform && providerName) {
      this.currentPlatform.textContent = providerName;
    }

    this.eventBus.emit(EVENTS.APP_EVENTS.PLATFORM_CHANGED, {
      platform: provider,
      displayName: providerName
    });

    this.platformMenu.open = false;
    this.removeBlurEffect();
  }

  checkHasInvoiceData() {
    return this.dataEngine.getInvoiceCount() > 0;
  }

  async showPlatformSwitchConfirmation() {
    if (this.dialogManager && this.dialogManager.showConfirmDialog) {
      return await this.dialogManager.showConfirmDialog(
        '切換平台',
        '切換平台將會清空所有發票資料，確定要繼續嗎？',
        '切換',
        '取消',
        'swap_horiz'
      );
    }
    return confirm(
      '切換平台將會清空所有發票資料，確定要繼續嗎？'
    );
  }

  removeBlurEffect() {
    if (this.previewSection) {
      this.previewSection.classList.remove('menu-blur');
    }
  }


  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
