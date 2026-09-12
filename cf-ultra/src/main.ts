import { boot } from './app';
import { initI18n } from './lib/i18n';
import './styles.css';

try {
  initI18n();
} catch (err) {
  console.warn('[ViralRefer Ultra] i18n init skipped:', err);
}

boot();
