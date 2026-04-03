import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { WhatsAppIcon } from '../components/icons'

const CheckIcon = () => (
  <div className="shrink-0 w-[26px] h-[26px] bg-[#25D366] rounded-full flex items-center justify-center mt-0.5">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </div>
)

const XIcon = () => (
  <span className="text-red-500 font-extrabold text-2xl leading-7">×</span>
)

const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center">
    <div className="text-4xl font-extrabold text-[#25D366] mb-1">{value}</div>
    <div className="text-sm text-white/60 uppercase tracking-wider">{label}</div>
  </div>
)

export function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Retorna — Recupere Clientes Inativos pelo WhatsApp | SaaS para Restaurantes'

    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? 'property' : 'name'
      let el = document.querySelector('meta[' + attr + '="' + name + '"]') as HTMLMetaElement
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('description', 'Retorna envia mensagens automáticas pelo WhatsApp para trazer de volta clientes que pararam de frequentar seu restaurante. Veja o faturamento gerado em reais. Teste grátis.')
    setMeta('keywords', 'recuperar clientes restaurante, WhatsApp marketing restaurante, fidelização clientes, retenção clientes restaurante, sistema CRM restaurante brasil')
    setMeta('robots', 'index, follow')
    setMeta('author', 'Retorna')
    setMeta('og:title', 'Retorna — Seus clientes já existem. Eles só pararam de voltar.', true)
    setMeta('og:description', 'Sistema automático que recupera clientes inativos do seu restaurante via WhatsApp. Veja exatamente quanto faturamento cada campanha gerou.', true)
    setMeta('og:type', 'website', true)
    setMeta('og:url', 'https://retornabrasil.com', true)
    setMeta('og:image', 'https://retornabrasil.com/images/hero.webp', true)
    setMeta('og:locale', 'pt_BR', true)
    setMeta('og:site_name', 'Retorna', true)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', 'Retorna — Recupere clientes inativos pelo WhatsApp')
    setMeta('twitter:description', 'Sistema automático que traz clientes de volta ao seu restaurante. Teste grátis.')
    setMeta('twitter:image', 'https://retornabrasil.com/images/hero.webp')

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = 'https://retornabrasil.com'

    const existing = document.getElementById('schema-org')
    if (existing) existing.remove()
    const schema = document.createElement('script')
    schema.id = 'schema-org'
    schema.type = 'application/ld+json'
    schema.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Retorna',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Sistema SaaS que recupera clientes inativos de restaurantes via WhatsApp automaticamente.',
      url: 'https://retornabrasil.com',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL', description: 'Teste inicial gratuito' },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '87' },
    })
    document.head.appendChild(schema)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <div className="min-h-screen bg-white text-[#2d2d3a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-[1320px] mx-auto px-6 py-3 flex items-center justify-between">
          <button onClick={scrollToTop} className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0" aria-label="Retorna - início">
            <img src="/images/Gemini_Generated_Image_v8qw99v8qw99v8qw.png" alt="Logo Retorna" className="h-16 w-auto" />
            <span className="text-2xl font-extrabold text-[#1a1a2e]">Retorna</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="text-sm font-semibold text-[#2d2d3a] hover:text-[#1a1a2e] bg-transparent border-none cursor-pointer">Entrar</button>
            <button onClick={() => navigate('/comecar')} className="text-sm font-bold text-white bg-[#25D366] px-5 py-2 rounded-full hover:bg-[#1DA851] transition-colors cursor-pointer border-none">Começar grátis</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-[88vh] flex items-center justify-center text-center overflow-hidden pt-14" aria-label="Apresentação do Retorna">
        <div className="absolute inset-0 bg-[url('/images/hero.webp')] bg-center bg-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/65" />
        <div className="relative z-10 max-w-[1000px] mx-auto px-6 py-20">
          <p className="text-sm font-bold tracking-widest uppercase text-[#25D366] mb-4">Para donos de restaurante</p>
          <h1 className="text-[clamp(2.4rem,5.5vw,3.8rem)] font-extrabold leading-tight text-white mb-6 [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">
            Seus clientes já existem.<br /><span className="text-[#25D366]">Eles só pararam de voltar.</span>
          </h1>
          <p className="text-xl text-white/90 max-w-[680px] mx-auto mb-4 [text-shadow:0_1px_6px_rgba(0,0,0,0.4)]">
            O Retorna envia mensagens personalizadas pelo WhatsApp para reativar clientes inativos e mostra exatamente quanto faturamento cada um gerou quando voltou.
          </p>
          <p className="text-base text-white/70 mb-10 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">Sem anúncios. Sem complicação. Só clientes voltando.</p>
          <button onClick={() => navigate('/comecar')} className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-10 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none shadow-lg shadow-green-900/30">
            <WhatsAppIcon size={22} />Quero trazer meus clientes de volta
          </button>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-white/60">
            <span>✓ Teste grátis</span><span>✓ Sem cartão de crédito</span><span>✓ Funciona em dias</span>
          </div>
        </div>
      </section>

      {/* NÚM EROS */}
      <section className="bg-[#1a1a2e] py-12" aria-label="Resultados do Retorna">
        <div className="max-w-[1320px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            <StatCard value="18%" label="Taxa média de retorno" />
            <StatCard value="7 dias" label="Para ver primeiros resultados" />
            <StatCard value="R$ 2.350" label="Faturamento médio por campanha" />
            <StatCard value="100%" label="Conforme LGPD e WhatsApp" />
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-20 bg-[#f8f9fb]" aria-label="O problema de clientes inativos">
        <div className="max-w-[1320px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">O problema</p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-tight text-[#1a1a2e] mb-4">Você está perdendo dinheiro todos os dias sem perceber</h2>
              <p className="text-[#6b7280] mb-8 text-lg leading-relaxed">A maioria dos restaurantes gasta para conquistar novos clientes, mas deixa os que já vieram — e gostaram — simplesmente sumirem.</p>
              <ul className="space-y-4">
                {['Você já investiu para conquistar esses clientes','Muitos vieram uma ou duas vezes e nunca mais voltaram','Ninguém faz follow-up com quem sumiu','Cada cliente inativo é dinheiro deixado na mesa','Você não sabe quanto está perdendo por mês'].map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-lg"><XIcon /><span>{t}</span></li>
                ))}
              </ul>
              <div className="mt-8 p-5 bg-white rounded-xl border border-red-100 shadow-sm">
                <p className="text-[#1a1a2e] font-semibold text-base">💡 <strong>Reconquistar um cliente existente custa até 5× menos</strong> do que conquistar um novo — e ele gasta em média 67% a mais.</p>
              </div>
            </div>
            <div>
              <img src="/images/empty.webp" alt="Restaurante com mesas vazias — clientes inativos gerando prejuízo" className="w-full rounded-2xl shadow-xl object-cover aspect-[4/3]" loading="lazy" width={640} height={480} />
            </div>
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-20" aria-label="Como o Retorna resolve o problema">
        <div className="max-w-[1320px] mx-auto px-6">
          <div className="max-w-[780px]">
            <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">A solução</p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-tight text-[#1a1a2e] mb-4">Um sistema simples que traz seus clientes de volta — no piloto automático</h2>
            <p className="text-[#6b7280] mb-10 text-lg leading-relaxed">O Retorna identifica quem parou de visitar seu restaurante e envia mensagens personalizadas pelo WhatsApp, no momento certo, com a mensagem certa.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
            {['Conecte o WhatsApp do restaurante em poucos minutos','O sistema detecta automaticamente quem parou de frequentar','Mensagens personalizadas reativam cada cliente de forma humana','Quando o cliente volta, você vê exatamente quanto gastou','Acompanhe o ROI de cada campanha em tempo real — em reais','Seus clientes escolhem receber: 100% LGPD e WhatsApp Business'].map((t, i) => (
              <div key={i} className="flex items-start gap-4 text-lg"><CheckIcon /><span>{t}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-20 bg-[#f8f9fb]" aria-label="Como funciona o Retorna">
        <div className="max-w-[1320px] mx-auto px-6 text-center">
          <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Como funciona</p>
          <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-tight text-[#1a1a2e] mb-3">3 passos. Sem complicação.</h2>
          <p className="text-[#6b7280] mb-12 text-lg max-w-[540px] mx-auto">Do zero ao primeiro cliente reativado em menos de uma semana.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[{n:'1',h:'Conecte seu WhatsApp',p:'Vincule o número do seu restaurante em poucos minutos. Sem configuração técnica.',icon:'📱'},{n:'2',h:'Sistema identifica inativos',p:'Automaticamente detecta clientes que pararam de voltar e monta as campanhas.',icon:'🔍'},{n:'3',h:'Veja clientes voltando',p:'Acompanhe quem retornou e o faturamento gerado — em reais, em tempo real.',icon:'📈'}].map(s => (
              <div key={s.n} className="text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{s.icon}</div>
                <div className="w-10 h-10 rounded-full bg-[#25D366] text-white text-base font-extrabold inline-flex items-center justify-center mb-4">{s.n}</div>
                <h3 className="text-xl font-bold text-[#1a1a2e] mb-2">{s.h}</h3>
                <p className="text-base text-[#6b7280] leading-relaxed">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIDEO */}
      <section className="py-20 bg-[#1a1a2e]" aria-label="Veja o Retorna em ação">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <p className="text-sm font-bold tracking-widest uppercase text-[#25D366] mb-3">Veja como funciona</p>
          <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-tight text-white mb-4">
            Em menos de 2 minutos você entende tudo
          </h2>
          <p className="text-white/60 mb-10 text-lg">Assista e veja como o Retorna traz seus clientes de volta.</p>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 mx-auto" style={{maxWidth: '780px'}}>
            <img
              src="/images/poster-video.png"
              alt="Descubra como funciona o Retorna"
              className="w-full rounded-2xl block"
              style={{aspectRatio: '16/9', objectFit: 'cover', cursor: 'pointer'}}
              onClick={(e) => {
                const img = e.currentTarget;
                const container = img.parentElement;
                if (!container) return;
                img.style.display = 'none';
                const play = container.querySelector('.play-btn') as HTMLElement;
                if (play) play.style.display = 'none';
                const vid = container.querySelector('video') as HTMLVideoElement;
                if (vid) { vid.style.display = 'block'; vid.play(); }
              }}
            />
            <div className="play-btn" style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '80px', background: 'rgba(0,0,0,0.65)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            </div>
            <video controls playsInline preload="none" className="w-full rounded-2xl block" style={{aspectRatio: '16/9', display: 'none'}}>
              <source src="/images/d2e1ae58e7fb4654ac7f37923a0f7983.mp4" type="video/mp4" />
            </video>
          </div>
          <button
            onClick={() => window.open('/comecar', '_self')}
            className="mt-10 inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-10 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none shadow-lg shadow-green-900/30"
          >
            Quero começar grátis
          </button>
        </div>
      </section>

            {/* RESULTADOS */}
      <section className="py-20" aria-label="Resultados reais do Retorna">
        <div className="max-w-[1320px] mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Resultados reais</p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-tight text-[#1a1a2e] mb-3">Veja o que acontece quando você para de ignorar seus clientes inativos</h2>
            <p className="text-[#6b7280] text-lg max-w-[560px] mx-auto">Uma campanha real. Números reais. Em menos de 7 dias.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-[1100px] mx-auto">
            <img src="/images/full.webp" alt="Restaurante cheio de clientes reativados pelo Retorna" className="w-full rounded-2xl shadow-xl object-cover aspect-[4/3]" loading="lazy" width={640} height={480} />
            <div>
              <div className="bg-[#1a1a2e] text-white rounded-2xl p-10 md:p-12">
                <p className="text-sm font-bold tracking-wider uppercase text-white/40 mb-8">Exemplo real de campanha</p>
                {[{label:'Clientes inativos contatados',value:'120',sub:'via WhatsApp'},{label:'Clientes que voltaram',value:'18',sub:'15% de conversão'},{label:'Faturamento gerado',value:'R$ 2.350',sub:'em 7 dias',highlight:true}].map((r,i) => (
                  <div key={i} className={"flex justify-between items-start py-5 " + (i < 2 ? 'border-b border-white/10' : '')}>
                    <div><p className="text-base text-white/75">{r.label}</p><p className="text-xs text-white/35 mt-0.5">{r.sub}</p></div>
                    <span className={"font-extrabold ml-4 " + (r.highlight ? 'text-[#25D366] text-3xl' : 'text-2xl')}>{r.value}</span>
                  </div>
                ))}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs text-white/35 leading-relaxed">Resultado de campanha real com restaurante brasileiro. Os números variam conforme o tamanho da base e o tempo de inatividade dos clientes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-[#f8f9fb]" aria-label="Perguntas frequentes sobre o Retorna">
        <div className="max-w-[780px] mx-auto px-6">
          <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3 text-center">Dúvidas frequentes</p>
          <h2 className="text-[clamp(1.8rem,3vw,2.2rem)] font-extrabold text-[#1a1a2e] mb-12 text-center">Respostas diretas</h2>
          <div className="space-y-6">
            {[{q:'Preciso saber de tecnologia para usar?',a:'Não. Se você sabe usar o WhatsApp, você usa o Retorna. A configuração leva menos de 10 minutos.'},{q:'E legal enviar mensagens para meus clientes?',a:'Sim — desde que seus clientes tenham optado por receber mensagens ao se cadastrar. O Retorna funciona dentro das regras do WhatsApp Business e da LGPD. Cada mensagem inclui opção de descadastro.'},{q:'Em quanto tempo vejo resultado?',a:'A maioria dos restaurantes vê os primeiros clientes retornando em 3 a 7 dias após a primeira campanha.'}].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-[#1a1a2e] mb-2">{faq.q}</h3>
                <p className="text-[#6b7280] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-[#1a1a2e] text-center" aria-label="Começe a usar o Retorna">
        <div className="max-w-[760px] mx-auto px-6">
          <p className="text-[#25D366] text-sm font-bold tracking-widest uppercase mb-4">Comece hoje</p>
          <h2 className="text-[clamp(1.8rem,4.5vw,2.8rem)] font-extrabold text-white mb-4 leading-tight">Pare de perder clientes todos os dias.</h2>
          <p className="text-white/60 mb-10 text-lg max-w-[520px] mx-auto leading-relaxed">Cada semana sem o Retorna é uma semana de clientes que foram — e não voltaram. Comece agora, é grátis.</p>
          <button onClick={() => navigate('/comecar')} className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-10 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none shadow-xl shadow-green-900/30">
            <WhatsAppIcon size={22} />Quero trazer meus clientes de volta
          </button>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-white/40">
            <span>✓ Teste grátis</span><span>✓ Sem cartão de crédito</span><span>✓ Cancele quando quiser</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-10 text-[0.85rem] text-[#6b7280] border-t border-gray-200">
        <div className="max-w-[1320px] mx-auto px-6">
          <p className="font-semibold text-[#1a1a2e] mb-1">Retorna</p>
          <p className="mb-3">© 2026 · Todos os direitos reservados</p>
          <div className="space-x-4 mb-4">
            <button onClick={() => navigate('/privacy')} className="hover:underline cursor-pointer bg-transparent border-none text-[#6b7280] text-[0.85rem]">Privacidade</button>
            <button onClick={() => navigate('/termos')} className="hover:underline cursor-pointer bg-transparent border-none text-[#6b7280] text-[0.85rem]">Termos de Uso</button>
          </div>
          <p className="text-xs text-gray-400 max-w-[520px] mx-auto leading-relaxed">Ao ativar o sistema, você confirma que possui autorização para contatar seus clientes via WhatsApp conforme a LGPD. Todas as mensagens incluem opção de descadastro.</p>
        </div>
      </footer>

    </div>
  )
}
torização para contatar seus clientes via WhatsApp conforme a LGPD. Todas as mensagens incluem opção de descadastro.</p>
        </div>
      </footer>

    </div>
  )
}
