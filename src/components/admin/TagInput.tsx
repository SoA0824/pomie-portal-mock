"use client";

import { useId, useState } from "react";

/**
 * チップ形式のタグ入力フィールド。
 * - 既存の値を ✕ 付きチップで表示
 * - 下部のテキスト入力 + 「+ 追加」ボタンで新しい値を追加
 * - Enter / カンマ で確定、カンマ・読点で分割して複数登録も可
 * - 末尾空欄時の Backspace で最後のチップを削除
 * - suggestions を渡すと <datalist> 経由でブラウザがオートコンプリート
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const items = raw
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    const next = [...value];
    for (const item of items) {
      if (!next.includes(item)) next.push(item);
    }
    onChange(next);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && text === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-pomie-100 px-3 py-1 text-xs text-pomie-700"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-pomie-500 hover:text-red-600"
                aria-label={`「${v}」を削除`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          list={suggestions.length > 0 ? listId : undefined}
          placeholder={placeholder}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => add(text)}
          disabled={!text.trim()}
          className="rounded-full border border-pomie-500 px-3 py-1 text-xs font-semibold text-pomie-600 hover:bg-pomie-100 disabled:opacity-40"
        >
          + 追加
        </button>
      </div>
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <p className="text-[11px] text-ink-500">
        候補から選ぶか、自由入力して Enter / 「追加」で登録（カンマ・読点区切りで複数まとめて追加可）
      </p>
    </div>
  );
}
