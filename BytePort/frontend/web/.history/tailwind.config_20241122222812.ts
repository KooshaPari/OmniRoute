import aspectRatio from '@tailwindcss/aspect-ratio';
import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
const darkTheme = {
	primary: '#80d5cf',
	onPrimary: '#003734',
	primaryContainer: '#00504c',
	onPrimaryContainer: '#9df1eb',
	secondary: '#83d2e3',
	onSecondary: '#00363e',
	secondaryContainer: '#004e5a',
	onSecondaryContainer: '#a2eeff',
	tertiary: '#9bcbfb',
	onTertiary: '#003353',
	tertiaryContainer: '#0e4a73',
	onTertiaryContainer: '#cee5ff',
	error: '#ffb4ab',
	onError: '#690005',
	errorContainer: '#93000a',
	onErrorContainer: '#ffdada',
	background: '#0e1514',
	onBackground: '#dde4e2',
	surface: '#101418',
	onSurface: '#e1e2e8',
	surfaceVariant: '#3f4948',
	onSurfaceVariant: '#bec9c7',
	outline: '#889391',
	inverseSurface: '#e1e2e8',
	inverseOnSurface: '#2e3135',
	inversePrimary: '#006a65'
};
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			colors: {
				dark: darkTheme
			}
		}
	},

	plugins: [typography, forms, containerQueries, aspectRatio]
} satisfies Config;
