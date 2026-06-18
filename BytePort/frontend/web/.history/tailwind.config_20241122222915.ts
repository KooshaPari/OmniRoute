import aspectRatio from '@tailwindcss/aspect-ratio';
import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
const darkTheme = {
	primary: '#80d5cf',
	surfaceTint: '#80d5cf',
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
	outlineVariant: '#3f4948',
	shadow: '#000000',
	scrim: '#000000',
	inverseSurface: '#e1e2e8',
	inverseOnSurface: '#2e3135',
	inversePrimary: '#006a65',
	primaryFixed: '#9df1eb',
	onPrimaryFixed: '#00201e',
	primaryFixedDim: '#80d5cf',
	onPrimaryFixedVariant: '#00504c',
	secondaryFixed: '#a2eeff',
	onSecondaryFixed: '#001f25',
	secondaryFixedDim: '#83d2e3',
	onSecondaryFixedVariant: '#004e5a',
	tertiaryFixed: '#cee5ff',
	onTertiaryFixed: '#001d33',
	tertiaryFixedDim: '#9bcbfb',
	onTertiaryFixedVariant: '#0e4a73',
	surfaceDim: '#101418',
	surfaceBright: '#36393e',
	surfaceContainerLowest: '#0b0e13',
	surfaceContainerLow: '#191c20',
	surfaceContainer: '#1d2024',
	surfaceContainerHigh: '#272a2f',
	surfaceContainerHighest: '#32353a'
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
