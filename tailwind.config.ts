import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17181C",
        paper: "#FFFFFF",
        mist: "#F2F3F5",
        line: "#E3E5E8",
        tag: "#FFD400",       // 시그니처: 가격표 옐로우
        tagInk: "#191500",
        priced: "#0BA360",    // 가격정보 있음 마커
        muted: "#8A8F98",
        danger: "#E5484D"
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "-apple-system", "system-ui", "sans-serif"]
      },
      boxShadow: {
        sheet: "0 -8px 30px rgba(23,24,28,0.12)",
        chip: "2px 2px 0 0 #17181C"
      }
    }
  },
  plugins: []
};
export default config;
