import operatorJson from "../../../data/operator.json";

/**
 * サイトの運営者情報（プライバシーポリシー・運営者情報ページ・構造化データで使う）。
 * confirmed が false の間は、運営者情報ページとプライバシーポリシーを公開しない
 * （運営者の確認が取れるまで、誤った会社名を載せないため）。
 */
export type Operator = {
  confirmed: boolean;
  siteName: string;
  companyName: string;
  postalCode: string;
  address: string;
  representatives: string[];
  founded: string;
  business: string[];
  officialSiteUrl: string;
  contactUrl: string;
  corporatePrivacyPolicyUrl: string;
  privacyPolicyEstablished: string;
};

export const OPERATOR = operatorJson as Operator;
