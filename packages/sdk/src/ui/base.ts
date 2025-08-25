/**
 * Base UI Component Class
 * Separated to avoid circular dependencies
 */

// Theme definitions
export const themes = {
    light: {
        background: '#ffffff',
        surface: '#f8f9fa',
        border: '#e9ecef',
        text: '#212529',
        textMuted: '#6c757d',
        primary: '#0d6efd',
        success: '#198754',
        warning: '#ffc107',
        danger: '#dc3545',
        shadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    dark: {
        background: '#0d1117',
        surface: '#161b22',
        border: '#30363d',
        text: '#f0f6fc',
        textMuted: '#8b949e',
        primary: '#1f6feb',
        success: '#238636',
        warning: '#d29922',
        danger: '#da3633',
        shadow: '0 2px 8px rgba(0,0,0,0.3)'
    }
};

export interface ComponentConfig {
    theme?: 'light' | 'dark' | 'auto' | 'custom';
    className?: string;
    style?: Record<string, string>;
    debug?: boolean;
}

// Utility functions
export function getTheme(themeName: string = 'light') {
    if (themeName === 'auto') {
        themeName = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themes[themeName as keyof typeof themes] || themes.light;
}

export function createElement(tag: string, attributes: Record<string, any> = {}, children: (string | HTMLElement)[] = []): HTMLElement {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key === 'className') {
            element.className = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else {
            element.appendChild(child);
        }
    });

    return element;
}

export function formatTimestamp(timestamp: number | string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function sanitizeHtml(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

// Base Component Class
export abstract class AxonUIComponent {
    public config: ComponentConfig;
    protected theme: any;
    protected container: HTMLElement | null = null;
    protected destroyed = false;

    constructor(config: ComponentConfig) {
        this.config = { theme: 'light', ...config };
        this.theme = getTheme(this.config.theme);
    }

    public abstract render(): HTMLElement;

    mount(parent: string | HTMLElement): this {
        const parentElement = typeof parent === 'string' ? document.querySelector(parent) : parent;
        if (!parentElement) {
            throw new Error(`Parent element not found: ${parent}`);
        }

        this.container = this.render();
        parentElement.appendChild(this.container);
        return this;
    }

    unmount(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.destroy();
    }

    destroy(): void {
        this.destroyed = true;
    }

    protected applyTheme(element: HTMLElement, styles: Record<string, string>): void {
        const themedStyles = { ...styles };

        // Replace theme variables
        Object.entries(themedStyles).forEach(([key, value]) => {
            if (typeof value === 'string') {
                themedStyles[key] = value
                    .replace(/var\(--bg\)/g, this.theme.background)
                    .replace(/var\(--surface\)/g, this.theme.surface)
                    .replace(/var\(--border\)/g, this.theme.border)
                    .replace(/var\(--text\)/g, this.theme.text)
                    .replace(/var\(--text-muted\)/g, this.theme.textMuted)
                    .replace(/var\(--primary\)/g, this.theme.primary)
                    .replace(/var\(--success\)/g, this.theme.success)
                    .replace(/var\(--warning\)/g, this.theme.warning)
                    .replace(/var\(--danger\)/g, this.theme.danger)
                    .replace(/var\(--shadow\)/g, this.theme.shadow);
            }
        });

        Object.assign(element.style, themedStyles);
    }
}
