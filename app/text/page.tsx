import { TextShareForm } from "@/components/text-share-form";

export default function TextPage() {
  return (
    <>
      <section className="text-hero">
        <p className="eyebrow">
          <span /> 手机与电脑之间，轻松传递
        </p>
        <h1>
          长文本，发个链接就好<span>。</span>
        </h1>
        <p>粘贴长文本，生成短链接。对方打开，即可复制完整原文。</p>
      </section>
      <div className="text-workspace">
        <TextShareForm />
        <aside className="text-help">
          <h2>三步完成分享</h2>
          <ol>
            <li>
              <b>01</b>
              <div>
                <h3>复制要分享的原文</h3>
                <p>
                  手机上长按文字，选择「全选」再复制。电脑上可用 Ctrl + A
                  全选、Ctrl + C 复制；Mac 使用 ⌘ + A、⌘ + C。
                </p>
              </div>
            </li>
            <li>
              <b>02</b>
              <div>
                <h3>粘贴并检查</h3>
                <p>
                  粘贴到输入框。分享 JSON 时选择 JSON 模式，页面会自动检查格式。
                </p>
              </div>
            </li>
            <li>
              <b>03</b>
              <div>
                <h3>把链接发给对方</h3>
                <p>
                  点击生成，弹窗中会显示分享链接并尝试复制。复制失败时，可以点击按钮或手动选择链接复制。
                </p>
              </div>
            </li>
          </ol>
          <div className="text-help-note">
            <strong>分享前请留意</strong>
            <p>
              持有链接的人都能打开这份文本，请勿粘贴你不希望被他人看到的私人信息。
            </p>
            <p>
              文本原样保存，不自动格式化。链接 24 小时后失效，也可提前删除。
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
