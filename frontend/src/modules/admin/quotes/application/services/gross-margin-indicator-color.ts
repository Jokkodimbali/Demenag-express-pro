export const GROSS_MARGIN_COLOR_THRESHOLD = 50_000;

export function grossMarginIndicatorColor(
  margin: number | null,
  aboveThresholdColor: string,
  belowThresholdColor: string,
): string | undefined {
  if (margin == null || margin === GROSS_MARGIN_COLOR_THRESHOLD) return undefined;
  const configuredColor =
    margin > GROSS_MARGIN_COLOR_THRESHOLD ? aboveThresholdColor : belowThresholdColor;
  return /^#[0-9a-f]{6}$/iu.test(configuredColor) ? configuredColor : undefined;
}
