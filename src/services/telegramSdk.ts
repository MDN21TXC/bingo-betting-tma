// Telegram WebApp SDK Wrapper & Bridge

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        enableClosingConfirmation: () => void;
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        themeParams: Record<string, string>;
        initData?: string;
        initDataUnsafe?: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
          auth_date?: number;
          hash?: string;
          start_param?: string;
        };
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
      };
    };
  }
}

export class TelegramSdkService {
  private isTma: boolean = false;

  constructor() {
    this.init();
  }

  public init() {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#090d16');
        tg.setBackgroundColor('#090d16');
        tg.enableClosingConfirmation();
        this.isTma = true;
      } catch (e) {
        console.warn('Telegram SDK initialization note:', e);
      }
    }
  }

  public isInsideTelegram(): boolean {
    return Boolean(
      typeof window !== 'undefined' &&
        (window.Telegram?.WebApp?.initData || window.Telegram?.WebApp?.initDataUnsafe?.user)
    );
  }

  public getInitData(): string {
    if (typeof window !== 'undefined') {
      if (window.Telegram?.WebApp?.initData) {
        return window.Telegram.WebApp.initData;
      }
      // Check query string for tgWebAppData
      if (window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const tgWebAppData = urlParams.get('tgWebAppData');
        if (tgWebAppData) return tgWebAppData;
      }
      // Check hash fragment for tgWebAppData
      if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const tgWebAppData = hashParams.get('tgWebAppData');
        if (tgWebAppData) return tgWebAppData;
      }
    }
    return '';
  }

  public getStartParam(): string | null {
    if (typeof window !== 'undefined') {
      if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
        return window.Telegram.WebApp.initDataUnsafe.start_param;
      }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('startapp')) return urlParams.get('startapp');
      if (urlParams.get('start')) return urlParams.get('start');
      if (urlParams.get('ref')) return urlParams.get('ref');
    }
    return null;
  }

  public getUserProfile(): { id: string; username: string; avatarUrl?: string } | null {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
      const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
      return {
        id: `tg_${tgUser.id}`,
        username: tgUser.username || tgUser.first_name || 'TG_Player',
        avatarUrl: tgUser.photo_url
      };
    }
    return null;
  }

  public triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection') {
    if (typeof window === 'undefined') return;

    try {
      const tg = window.Telegram?.WebApp?.HapticFeedback;
      if (tg) {
        if (type === 'light' || type === 'medium' || type === 'heavy') {
          tg.impactOccurred(type);
        } else if (type === 'success' || type === 'warning' || type === 'error') {
          tg.notificationOccurred(type);
        } else if (type === 'selection') {
          tg.selectionChanged();
        }
      } else if (navigator.vibrate) {
        // Fallback for mobile browsers supporting vibration API
        if (type === 'light' || type === 'selection') navigator.vibrate(10);
        else if (type === 'medium') navigator.vibrate(25);
        else if (type === 'heavy' || type === 'success') navigator.vibrate([40, 30, 40]);
        else if (type === 'error') navigator.vibrate([50, 50, 50]);
      }
    } catch (e) {}
  }

  public openTelegramLink(url: string) {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      try {
        window.Telegram.WebApp.openTelegramLink(url);
        return;
      } catch (e) {
        console.warn('openTelegramLink error:', e);
      }
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }
}

export const telegramSdk = new TelegramSdkService();
