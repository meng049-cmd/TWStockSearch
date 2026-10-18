import type {Metadata} from 'next';
export const metadata:Metadata={title:'轉折研究室｜台股與期貨工作站',description:'價量、法人、融資交叉研究，資料庫留存與多標的比較。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body>{children}</body></html>}
