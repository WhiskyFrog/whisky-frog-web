import { redirect } from "next/navigation";

// 관리자 첫 진입은 첫 메뉴(마켓 관리)로 보낸다.
export default function AdminIndex() {
  redirect("/admin/markets");
}
