import { boot } from './app';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app missing');
boot(root);
