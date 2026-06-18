import aspectRatio from '@tailwindcss/aspect-ratio';
import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
const darkTheme = {
	primary: '#80D5CF',
	onPrimary: '#003734',
	primaryContainer: '#00504C',
	onPrimaryContainer: '#9DF1EB',
	secondary: '#83D2E3',
	onSecondary: '#00363E',
	secondaryContainer: '#004E5A',
	onSecondaryContainer: '#A2EEFF',
	tertiary: '#9BCBFB',
	onTertiary: '#003353',
	tertiaryContainer: '#0E4A73',
	onTertiaryContainer: '#CEE5FF',
	error: '#FFB4AB',
	onError: '#690005',
	background: '#0E1514',
	onBackground: '#DDE4E2',
	surface: '#101418',
	onSurface: '#E1E2E8',
	surfaceVariant: '#3F4948',
	onSurfaceVariant: '#BEC9C7',
	outline: '#889391'
};
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {

		extend: {}
	},

	plugins: [typography, forms, containerQueries, aspectRatio]
} satisfies Config;
