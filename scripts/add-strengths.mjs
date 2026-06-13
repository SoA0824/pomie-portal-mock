#!/usr/bin/env node
// data/stylists.json に strengths を 1 回だけ追加するワンショット
import { readFileSync, writeFileSync } from "node:fs";

const STRENGTHS = {
  "st-01": ["髪質改善のプロ", "ダメージレス施術", "扱いやすい仕上がり"],
  "st-02": ["メンズスタイル専門", "外国人風カラー", "再現性重視"],
  "st-03": ["似合わせカット", "顔タイプ診断対応", "30〜40代女性に人気"],
  "st-04": ["メンズスタイル専門", "韓国スタイル", "20代男性に人気"],
  "st-05": ["ハイトーンカラー得意"],
  "st-06": ["ショート・ボブ専門", "30〜40代女性に人気", "白髪ぼかし"],
  "st-07": ["ブライダル特化", "顔タイプ診断対応", "ナチュラル系"],
  "st-08": ["髪質改善のプロ", "頭皮ケア・スパ", "再現性重視"],
  "st-09": ["メンズスタイル専門"],
  "st-10": ["ハイトーンカラー得意", "外国人風カラー", "デザインカット"],
  "st-11": ["ロングヘア専門", "扱いやすい仕上がり", "再現性重視"],
  "st-12": ["扱いやすい仕上がり"],
};

const path = "./data/stylists.json";
const data = JSON.parse(readFileSync(path, "utf8"));
for (const s of data) {
  if (STRENGTHS[s.id]) {
    s.strengths = STRENGTHS[s.id];
  } else if (!s.strengths) {
    s.strengths = [];
  }
}
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`Updated ${data.length} stylists`);
