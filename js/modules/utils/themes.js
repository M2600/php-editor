
export const THEMES = [
	{
		name: 'light',
		aceTheme: 'ace/theme/chrome',
		customTitle: 'PHP Editor'
	},
	{
		name: 'dark',
		aceTheme: 'ace/theme/monokai',
		customTitle: 'PHP Editor'
	},
	{
		start: { month: 10, day: 25 }, // 10月25日
		end: { month: 10, day: 31 },    // 11月1日
		name: 'halloween',
		aceTheme: 'ace/theme/vibrant_ink',
		customTitle: 'PHP Edit🎃r'
	},
	{
		start: {month: 10, day:20},
		end: {month: 12, day:25},
		name: 'christmas',
		aceTheme: 'ace/theme/tomorrow',
		customTitle: 'PHP Ed🎄tor'
	}
	// 将来的に他のイベントテーマを追加する場合はここに追加

];

export function getThemeByName(name) {
	for (const theme of THEMES) {
		if (theme.name === name) {
			return theme;
		}
	}
	return null;
}


export function getEventTheme() {
	const now = new Date();
	for (const theme of THEMES) {
		if (!theme.start || !theme.end) {
			continue; // イベントテーマでない場合はスキップ
		}
		const startDate = new Date(now.getFullYear(), theme.start.month - 1, theme.start.day);
		const endDate = new Date(now.getFullYear(), theme.end.month - 1, theme.end.day, 23, 59, 59);
		if (now >= startDate && now <= endDate) {
			return theme;
		}
	}
	return null;
}