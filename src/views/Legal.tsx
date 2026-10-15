"use client";
import { useCopy, useFormatting } from "../i18n";
import { useTranslations } from "next-intl";

import { Link, useLocation } from "../routing";
import { useSite } from "../lib";

export default function Legal() {
  const copy = useCopy();
  const { date } = useFormatting();
  const t = useTranslations("common");
  const privacy = useLocation().pathname === "/privacy";
  const { openChat } = useSite();
  return (
    <div className="page container legal-page">
      <span className="eyebrow">{copy("CARE IN EVERY DETAIL")}</span>
      <h1>{privacy ? copy("隐私说明") : copy("预约须知")}</h1>
      <p className="subtle-note">
        {t("updated", { date: date("2026-10-15") })}
      </p>
      {privacy ? (
        <>
          <h2>{copy("我们保存哪些资料")}</h2>
          <p>
            {copy(
              "注册时保存邮箱、称呼和经过安全哈希处理的密码。预约时保存所选服务、时段、姓名、联系电话、备注与订单状态，用于与你沟通并履行预约服务。",
            )}
          </p>
          <h2>{copy("会话与社区")}</h2>
          <p>
            {copy(
              "客服与预约专属会话仅对会话所属顾客与管理员可见。消息自发送起保存 180 天，超过期限将不再展示并自动清理。社区帖子、称呼和回复公开可见；帖子可由发布者删除，违规内容可被管理员隐藏。",
            )}
          </p>
          <h2>{copy("支付资料")}</h2>
          <p>
            {copy(
              "在线支付由易支付兼容网关处理。本站保存订单金额、支付平台交易号与到账状态，不保存银行卡号或支付账户密码。点击支付后将跳转到支付服务提供方页面。",
            )}
          </p>
          <h2>{copy("账户与 Cookie")}</h2>
          <p>
            {copy(
              "网站还使用 YF_LOCALE Cookie 保存语言偏好，有效期一年；可随时通过语言菜单更改。",
            )}
          </p>
          <p>
            {copy(
              "网站使用必要的 HttpOnly 会话 Cookie 保持登录，不使用广告追踪 Cookie。登录会话有效期 7 天；退出登录后当前会话立即失效。若需查询、更正或申请删除账户相关资料，请联系顾问，由工作人员核实后处理。依法需要留存的交易记录可能继续保留。",
            )}
          </p>
          <h2>{copy("数据管理")}</h2>
          <p>
            {copy(
              "管理员应保护数据库、加密密钥与备份，并为含会话消息的备份设置不超过 180 天的生命周期。本站不会将你在非公开会话中提供的内容展示为宣传材料。",
            )}
          </p>
        </>
      ) : (
        <>
          <h2>{copy("预约流程")}</h2>
          <p>
            {copy(
              "请先注册并登录账户，选择服务、日期与可预约时段，填写有效联系方式。创建预约后，名额保留 30 分钟；请及时支付订金，未支付的订单到期后自动释放名额。所有预约时间采用北京时间。",
            )}
          </p>
          <h2>{copy("套餐与订金")}</h2>
          <p>
            {copy(
              "页面标注为示例的套餐价格仅用于展示，正式服务内容和报价以顾问确认的方案为准。订金计入套餐总费用；余款、礼服租赁押金、差旅及其他定制费用，如有，需在方案中单独确认。",
            )}
          </p>
          <h2>{copy("预约确认")}</h2>
          <p>
            {copy(
              "订金到账后，预约进入待确认状态；顾问确认档期后，订单显示“预约已确认”。支付返回页本身不代表到账，请以会员中心的订单状态为准。若订单过期后款项到账，顾问将协助核对档期或处理退款。",
            )}
          </p>
          <h2>{copy("改期、取消与退款")}</h2>
          <p>
            {copy(
              "未发起支付的待付订金订单可在会员中心取消。已进入支付流程、已支付或已确认的订单，需与顾问协商改期、取消与退款，具体条件应在服务前书面确认。网站暂不提供自动原路退款，不会仅修改订单状态来声称已退款。",
            )}
          </p>
          <h2>{copy("到店与拍摄")}</h2>
          <p>
            {copy(
              "请提前与顾问沟通服装尺码、妆容偏好、角色主题、过敏情况及其他需要协助的事项。我们尊重每一种性别与个人表达。作品用于展示前，应另行征得你的授权。",
            )}
          </p>
        </>
      )}
      <div className="legal-contact">
        <p>{copy("对条款或预约安排有疑问，可与专属顾问沟通。")}</p>
        <button className="button" onClick={() => openChat()}>
          {copy("联系专属顾问")}
        </button>
        <Link className="under-link" to={privacy ? "/terms" : "/privacy"}>
          {privacy ? copy("查看预约须知") : copy("查看隐私说明")}
        </Link>
      </div>
    </div>
  );
}
