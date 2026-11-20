import { Select } from "@mantine/core";
import { PROFICIENCY_LEVELS } from "./levels";

interface LevelSelectProps {
  value: number | null;
  onChange: (level: number | null) => void;
  label?: string;
}

const options = PROFICIENCY_LEVELS.map((level) => ({
  value: String(level.value),
  label: level.label,
}));

/** Proficiency level 1-5. Mantine's Select works with strings, the app with numbers. */
export function LevelSelect({
  value,
  onChange,
  label = "Level",
}: LevelSelectProps) {
  return (
    <Select
      label={label}
      placeholder="Select level"
      data={options}
      value={value === null ? null : String(value)}
      onChange={(selected) =>
        onChange(selected === null ? null : Number(selected))
      }
      allowDeselect={false}
    />
  );
}
