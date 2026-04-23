import type { ReactNode } from 'react';
import { SlidersHorizontal, TimerReset } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { SectionCard } from './shared';
import type { ColorFilterConfig, ColorFilterId } from './types';

function FilterAccordionItem({
  title,
  filterId,
  description,
  enabled,
  summary,
  onEnabledChange,
  onReset,
  children,
}: {
  title: string
  filterId: ColorFilterId
  description: string
  enabled: boolean
  summary: string
  onEnabledChange: (nextValue: boolean) => void
  onReset: (filterId: ColorFilterId) => void
  children?: ReactNode
}) {
  return (
    <AccordionItem
      value={filterId}
      className="rounded-2xl border border-border/60 bg-background/45 px-4 data-[state=open]:bg-background/65"
    >
      <AccordionTrigger className="gap-4 py-4 hover:no-underline">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
              {enabled ? summary : 'Off'}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-4 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
            <label className="flex items-center gap-3 text-sm text-foreground">
              <input
                className="size-4 accent-primary"
                type="checkbox"
                checked={enabled}
                onChange={(event) => onEnabledChange(event.target.checked)}
              />
              Enable filter
            </label>
            <Button size="sm" variant="outline" onClick={() => onReset(filterId)}>
              <TimerReset className="size-3.5" />
              Reset
            </Button>
          </div>
          {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function NumberControl({
  label,
  note,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  note: string
  min: number
  max: number
  step: number
  value: number
  onChange: (nextValue: number) => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-background/35 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
        <Slider min={min} max={max} step={step} value={[value]} onValueChange={([nextValue]) => onChange(nextValue ?? value)} />
        <Input
          className="h-10"
          type="number"
          min={String(min)}
          max={String(max)}
          step={String(step)}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

function ColorControl({
  label,
  note,
  value,
  onChange,
}: {
  label: string
  note: string
  value: string
  onChange: (nextValue: string) => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-background/35 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
        <input
          className="h-10 w-14 rounded-xl border border-border/60 bg-transparent p-1"
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input className="h-10 font-mono" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

export function FilterPanel({
  filterConfig,
  onFilterConfigChange,
  onResetAllFilters,
  onResetFilter,
}: {
  filterConfig: ColorFilterConfig
  onFilterConfigChange: (nextConfig: Partial<ColorFilterConfig>) => void
  onResetAllFilters: () => void
  onResetFilter: (filterId: ColorFilterId) => void
}) {
  const activeFilterCount = [
    filterConfig.blackAndWhiteEnabled,
    filterConfig.brightnessEnabled,
    filterConfig.browniEnabled,
    filterConfig.colorToneEnabled,
    filterConfig.contrastEnabled,
    filterConfig.desaturateEnabled,
    filterConfig.grayscaleEnabled,
    filterConfig.hueEnabled,
    filterConfig.kodachromeEnabled,
    filterConfig.lsdEnabled,
    filterConfig.negativeEnabled,
    filterConfig.nightEnabled,
    filterConfig.polaroidEnabled,
    filterConfig.predatorEnabled,
    filterConfig.saturationEnabled,
    filterConfig.sepiaEnabled,
    filterConfig.technicolorEnabled,
    filterConfig.tintEnabled,
    filterConfig.toBGREnabled,
    filterConfig.vintageEnabled,
  ].filter(Boolean).length;

  return (
    <SectionCard
      icon={SlidersHorizontal}
      title="Color Filters"
      description="Every Pixi color-matrix filter is grouped into its own accordion item to keep the control stack readable."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Filter stack</p>
            <p className="text-xs text-muted-foreground">
              {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'} applied in a stable order.
            </p>
          </div>
          <Button variant="outline" onClick={onResetAllFilters}>
            <TimerReset className="size-4" />
            Reset All
          </Button>
        </div>

        <Accordion type="multiple" className="space-y-3">
          <FilterAccordionItem
            title="Brightness"
            filterId="brightness"
            description="Multiply RGB channels to darken or brighten the scene."
            enabled={filterConfig.brightnessEnabled}
            summary={`${filterConfig.brightness.toFixed(2)}x`}
            onEnabledChange={(nextValue) => onFilterConfigChange({ brightnessEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Brightness"
              note="1 is neutral. Lower darkens, higher brightens."
              min={0}
              max={3}
              step={0.01}
              value={filterConfig.brightness}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  brightness: nextValue,
                  brightnessEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Contrast"
            filterId="contrast"
            description="Increase or flatten the separation between shadows and highlights."
            enabled={filterConfig.contrastEnabled}
            summary={filterConfig.contrast.toFixed(2)}
            onEnabledChange={(nextValue) => onFilterConfigChange({ contrastEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Contrast"
              note="0 is neutral. Higher values push light and dark apart."
              min={0}
              max={1}
              step={0.01}
              value={filterConfig.contrast}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  contrast: nextValue,
                  contrastEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Grayscale"
            filterId="grayscale"
            description="Convert the image toward grayscale using the runtime grayscale matrix."
            enabled={filterConfig.grayscaleEnabled}
            summary={filterConfig.grayscale.toFixed(2)}
            onEnabledChange={(nextValue) => onFilterConfigChange({ grayscaleEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Grayscale Amount"
              note="Higher values push harder into grayscale."
              min={0}
              max={1}
              step={0.01}
              value={filterConfig.grayscale}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  grayscale: nextValue,
                  grayscaleEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Hue"
            filterId="hue"
            description="Rotate colors around the wheel."
            enabled={filterConfig.hueEnabled}
            summary={`${Math.round(filterConfig.hue)}°`}
            onEnabledChange={(nextValue) => onFilterConfigChange({ hueEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Hue Rotation"
              note="0 is neutral. Negative and positive values rotate in opposite directions."
              min={-180}
              max={180}
              step={1}
              value={filterConfig.hue}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  hue: nextValue,
                  hueEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Saturation"
            filterId="saturation"
            description="Push colors toward grayscale or make them more vivid."
            enabled={filterConfig.saturationEnabled}
            summary={filterConfig.saturation.toFixed(2)}
            onEnabledChange={(nextValue) => onFilterConfigChange({ saturationEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Saturation"
              note="1 is neutral. 0 removes color. Values above 1 intensify it."
              min={0}
              max={3}
              step={0.01}
              value={filterConfig.saturation}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  saturation: nextValue,
                  saturationEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Tint"
            filterId="tint"
            description="Scale channels by a chosen tint color."
            enabled={filterConfig.tintEnabled}
            summary={filterConfig.tint}
            onEnabledChange={(nextValue) => onFilterConfigChange({ tintEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <ColorControl
              label="Tint Color"
              note="Six-digit hex color applied through the color matrix."
              value={filterConfig.tint}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  tint: nextValue,
                  tintEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Black And White"
            filterId="blackAndWhite"
            description="Apply the runtime luminance-based black-and-white preset."
            enabled={filterConfig.blackAndWhiteEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ blackAndWhiteEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Desaturate"
            filterId="desaturate"
            description="Force a full desaturation pass regardless of the saturation slider."
            enabled={filterConfig.desaturateEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ desaturateEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Negative"
            filterId="negative"
            description="Invert the source colors like a film negative."
            enabled={filterConfig.negativeEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ negativeEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Sepia"
            filterId="sepia"
            description="Apply the warm brown photographic preset."
            enabled={filterConfig.sepiaEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ sepiaEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Technicolor"
            filterId="technicolor"
            description="Recreate the exaggerated early-color Technicolor look."
            enabled={filterConfig.technicolorEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ technicolorEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Polaroid"
            filterId="polaroid"
            description="Apply the instant-photo preset with subtle shifts and contrast."
            enabled={filterConfig.polaroidEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ polaroidEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="To BGR"
            filterId="toBGR"
            description="Swap red and blue channels."
            enabled={filterConfig.toBGREnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ toBGREnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Kodachrome"
            filterId="kodachrome"
            description="Apply the Kodachrome-style film preset."
            enabled={filterConfig.kodachromeEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ kodachromeEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Browni"
            filterId="browni"
            description="Add the stylized brown-tinted preset."
            enabled={filterConfig.browniEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ browniEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Vintage"
            filterId="vintage"
            description="Apply the aged-photo vintage preset."
            enabled={filterConfig.vintageEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ vintageEnabled: nextValue })}
            onReset={onResetFilter}
          />

          <FilterAccordionItem
            title="Color Tone"
            filterId="colorTone"
            description="Gradient-map style toning with custom light and dark colors."
            enabled={filterConfig.colorToneEnabled}
            summary={`${filterConfig.colorToneLightColor} / ${filterConfig.colorToneDarkColor}`}
            onEnabledChange={(nextValue) => onFilterConfigChange({ colorToneEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Desaturation"
              note="Controls how much original color is removed before toning."
              min={0}
              max={1}
              step={0.01}
              value={filterConfig.colorToneDesaturation}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  colorToneDesaturation: nextValue,
                  colorToneEnabled: true,
                })}
            />
            <NumberControl
              label="Toned"
              note="Controls how strongly the tone colors push into the image."
              min={0}
              max={1}
              step={0.01}
              value={filterConfig.colorToneToned}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  colorToneEnabled: true,
                  colorToneToned: nextValue,
                })}
            />
            <ColorControl
              label="Light Color"
              note="Highlight tone color."
              value={filterConfig.colorToneLightColor}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  colorToneEnabled: true,
                  colorToneLightColor: nextValue,
                })}
            />
            <ColorControl
              label="Dark Color"
              note="Shadow tone color."
              value={filterConfig.colorToneDarkColor}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  colorToneDarkColor: nextValue,
                  colorToneEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Night"
            filterId="night"
            description="Apply the runtime night-vision matrix."
            enabled={filterConfig.nightEnabled}
            summary={filterConfig.nightIntensity.toFixed(2)}
            onEnabledChange={(nextValue) => onFilterConfigChange({ nightEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Night Intensity"
              note="0 is neutral. Higher values push deeper into the night-vision look."
              min={0}
              max={1}
              step={0.01}
              value={filterConfig.nightIntensity}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  nightEnabled: true,
                  nightIntensity: nextValue,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="Predator"
            filterId="predator"
            description="Apply the thermal-vision style matrix."
            enabled={filterConfig.predatorEnabled}
            summary={filterConfig.predatorAmount.toFixed(2)}
            onEnabledChange={(nextValue) => onFilterConfigChange({ predatorEnabled: nextValue })}
            onReset={onResetFilter}
          >
            <NumberControl
              label="Predator Amount"
              note="Controls the strength of the thermal-style effect."
              min={0}
              max={1}
              step={0.01}
              value={filterConfig.predatorAmount}
              onChange={(nextValue) =>
                onFilterConfigChange({
                  predatorAmount: nextValue,
                  predatorEnabled: true,
                })}
            />
          </FilterAccordionItem>

          <FilterAccordionItem
            title="LSD"
            filterId="lsd"
            description="Apply the high-distortion psychedelic color preset."
            enabled={filterConfig.lsdEnabled}
            summary="Preset"
            onEnabledChange={(nextValue) => onFilterConfigChange({ lsdEnabled: nextValue })}
            onReset={onResetFilter}
          />
        </Accordion>
      </div>
    </SectionCard>
  );
}
