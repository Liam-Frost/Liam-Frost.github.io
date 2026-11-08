import LoadingSkeleton from "./LoadingSkeleton";
import { splitEmphasis } from "@liam-frost/shared";
import { useMemo } from "react";

import { useAbout } from "../data/useAbout";
import { pickLocalized, useI18n, type Key } from "../lib/i18n";
import { manifestoClauses, manifestoWords, pickManifesto } from "../lib/manifesto";
import Reveal from "./Reveal";

const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;
const KANA = /[぀-ヿ]/;
const PRINCIPLES: Key[] = [
  "about.capabilities.b1",
  "about.capabilities.b2",
  "about.capabilities.b3"
];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The about section: a manifesto as the focal point, how I think in three principles, and the gear
 * as a spec sheet, all managed in the admin. One manifesto is chosen per visit by the configured
 * rotation, once the content has loaded.
 */
export default function AboutSection() {
  const { lang, t } = useI18n();
  const about = useAbout();
  const items = about?.manifestos ?? [];
  const manifesto = useMemo(
    () => (about ? pickManifesto(about.manifestos, about.rotation) : undefined),
    [about]
  );
  const text = manifesto ? pickLocalized(manifesto.text, lang) : "";
  const by = manifesto ? pickLocalized(manifesto.attribution, lang) : "";
  const index = manifesto ? items.indexOf(manifesto) + 1 : 0;

  if (about && !items.length && !about.gear.some((category) => category.items.length)) return null;

  return (
    <section className="section about" id="about">
      <div className="container">
        <Reveal intensity="subtle">
          <div className="aboutTop">
            <h2 className="aboutLabel">{t("about.title")}</h2>
            {items.length > 1 && (
              <span className="aboutCount">
                {pad(index)} — {pad(items.length)}
              </span>
            )}
          </div>
        </Reveal>

        {!about && <LoadingSkeleton label={t("about.title")} variant="rows" count={2} />}
        {text && (
          <Reveal>
            <figure className="manifesto">
              <blockquote>
                <p
                  className="manifestoText sectionSubtitle"
                  data-script={CJK.test(text) ? "cjk" : "latin"}
                >
                  {CJK.test(text)
                    ? manifestoClauses(
                        manifestoWords(splitEmphasis(text), true, KANA.test(text) ? "ja" : "zh")
                      ).map((clause, i) => (
                        <span key={i} className="manifestoClause">
                          {clause.map((runs, j) => (
                            <span key={j} className="manifestoWord">
                              {runs.map((run, k) =>
                                run.em ? <em key={k}>{run.text}</em> : run.text
                              )}
                            </span>
                          ))}
                        </span>
                      ))
                    : splitEmphasis(text).map((part, i) =>
                        part.em ? <em key={i}>{part.text}</em> : part.text
                      )}
                </p>
              </blockquote>
              {by && <figcaption className="manifestoBy">— {by}</figcaption>}
            </figure>
          </Reveal>
        )}

        <div className="aboutThink">
          <Reveal after>
            <h3 className="aboutLabel">{t("about.think")}</h3>
            <p className="aboutThinkText">{t("about.focus.body")}</p>
          </Reveal>
          <Reveal after stagger>
            <ol className="principles">
              {PRINCIPLES.map((key, i) => {
                const [title, ...rest] = t(key).split(/\s*[：:]\s*/);
                return (
                  <li key={key}>
                    <span className="principleNo">{pad(i + 1)}</span>
                    <strong>{title}</strong>
                    {rest.length > 0 && <span className="principleText">{rest.join(" : ")}</span>}
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>

        {about && about.gear.length > 0 && (
          <Reveal after>
            <div className="aboutGear">
              <h3 className="aboutLabel">{t("about.card.right")}</h3>
              <dl className="gearList">
                {about.gear.map((group) => (
                  <div key={group.id} className="gearRow">
                    <dt>{pickLocalized(group.name, lang)}</dt>
                    <dd>
                      {group.items.map((item) => (
                        <span key={item.id}>{item.name}</span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
