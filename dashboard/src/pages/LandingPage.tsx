import { useNavigate } from 'react-router-dom'
import { WhatsAppIcon } from '../components/icons'

const CheckIcon = () => (
  <div className="shrink-0 w-[26px] h-[26px] bg-[#25D366] rounded-full flex items-center justify-center mt-0.5">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </div>
)

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-[#2d2d3a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* HERO */}
      <section className="relative min-h-[80vh] flex items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/hero.webp')] bg-center bg-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 max-w-[1000px] mx-auto px-8 py-16">
          <p className="text-sm font-bold tracking-widest uppercase text-white/80 mb-4">Para restaurantes</p>
          <h1 className="text-[clamp(2.4rem,5.5vw,3.6rem)] font-extrabold leading-tight text-white mb-6 [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
            Seus clientes já existem.<br /><span className="text-[#25D366]">Eles só pararam de voltar.</span>
          </h1>
          <p className="text-xl text-white/90 max-w-[650px] mx-auto mb-10 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
            Recupere clientes inativos via WhatsApp e veja exatamente quanto faturamento eles geram quando voltam.
          </p>
          <button
            onClick={() => navigate('/comecar')}
            className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-10 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
          >
            <WhatsAppIcon size={22} />
            Quero trazer meus clientes de volta
          </button>
          <span className="block mt-3 text-sm text-white/60">Sem setup complicado · Funciona em poucos dias</span>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-14 bg-[#f8f9fb]">
        <div className="max-w-[1320px] mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">O problema</p>
              <h2 className="text-[2rem] font-extrabold leading-tight text-[#1a1a2e] mb-6">
                Você está perdendo faturamento<br />todos os dias — sem perceber
              </h2>
              <ul className="space-y-4">
                {[
                  'Você já investiu para conquistar esses clientes',
                  'Muitos vieram uma ou duas vezes e nunca mais voltaram',
                  'Ninguém faz follow-up com quem sumiu',
                  'Cada cliente inativo é dinheiro que você deixa na mesa',
                  'Você não tem como saber quanto está perdendo',
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-red-500 font-extrabold text-2xl leading-7">×</span>
                    <span className="text-lg">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <img src="/images/empty.webp" alt="Restaurante vazio" className="w-full rounded-xl shadow-lg object-cover aspect-[4/3]" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-14">
        <div className="max-w-[1320px] mx-auto px-8">
          <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">A solução</p>
          <h2 className="text-[2rem] font-extrabold leading-tight text-[#1a1a2e] mb-8">
            Um sistema simples que traz<br />seus clientes de volta
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
            {[
              'Conecte o WhatsApp do restaurante em poucos minutos',
              'O sistema detecta automaticamente quem parou de frequentar',
              'Mensagens personalizadas são enviadas via WhatsApp para reconquistar cada cliente',
              'Quando o cliente volta, você vê exatamente quanto ele gastou',
              'Acompanhe o ROI de cada campanha em tempo real — em reais',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-4 text-lg">
                <CheckIcon />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-14 bg-[#f8f9fb]">
        <div className="max-w-[1320px] mx-auto px-8 text-center">
          <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Como funciona</p>
          <h2 className="text-[2rem] font-extrabold leading-tight text-[#1a1a2e] mb-10">3 passos. Sem complicação.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              { n: '1', h: 'Conecte seu WhatsApp', p: 'Vincule o número do seu restaurante em poucos minutos.' },
              { n: '2', h: 'Sistema encontra clientes inativos', p: 'Identifica automaticamente quem parou de voltar.' },
              { n: '3', h: 'Veja quem voltou e quanto gastou', p: 'Acompanhe o retorno e o faturamento gerado em reais.' },
            ].map(s => (
              <div key={s.n} className="text-center bg-white rounded-2xl p-8 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-[#1a1a2e] text-white text-2xl font-extrabold inline-flex items-center justify-center mb-5">{s.n}</div>
                <h3 className="text-xl font-bold text-[#1a1a2e] mb-2">{s.h}</h3>
                <p className="text-base text-[#6b7280]">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA */}
      <section className="py-14 text-center">
        <div className="max-w-[1320px] mx-auto px-8">
          <p className="text-sm font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Resultados reais</p>
          <h2 className="text-[2rem] font-extrabold leading-tight text-[#1a1a2e] mb-3">
            Veja o que acontece quando você reativa seus clientes
          </h2>
          <p className="text-[#6b7280] mb-8 text-lg">Exemplo real de campanha Retorna</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-[1100px] mx-auto text-left">
            <img src="/images/full.webp" alt="Restaurante cheio" className="w-full rounded-xl shadow-lg object-cover aspect-[4/3]" loading="lazy" />
            <div className="bg-[#1a1a2e] text-white rounded-2xl p-10 md:p-12">
              <p className="text-sm font-bold tracking-wider uppercase text-white/50 mb-8">Exemplo real de campanha</p>
              {[
                { label: 'Clientes contatados', value: '120', highlight: false },
                { label: 'Clientes que voltaram', value: '18', highlight: false },
                { label: 'Faturamento gerado', value: 'R$ 2.350', highlight: true },
              ].map((r, i) => (
                <div key={i} className={`flex justify-between items-baseline py-4 ${i < 2 ? 'border-b border-white/10' : ''}`}>
                  <span className="text-base text-white/75">{r.label}</span>
                  <span className={`font-extrabold ${r.highlight ? 'text-[#25D366] text-3xl' : 'text-2xl'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="text-center py-14">
        <div className="max-w-[1000px] mx-auto px-8">
          <h2 className="text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold text-[#1a1a2e] mb-3">
            Pare de perder clientes<br />todos os dias
          </h2>
          <p className="text-[#6b7280] mb-8 text-lg">Ative o sistema e comece a recuperar faturamento já.</p>
          <button
            onClick={() => navigate('/comecar')}
            className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-10 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
          >
            <WhatsAppIcon size={22} />
            Quero trazer meus clientes de volta
          </button>
          <span className="block mt-3 text-sm text-[#6b7280]">Teste inicial · Sem compromisso</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-8 text-[0.85rem] text-[#6b7280] border-t border-gray-200">
        <div className="max-w-[1320px] mx-auto px-8">
          Retorna &copy; 2026 &middot; Todos os direitos reservados
          <div className="mt-2 space-x-4">
            <button onClick={() => navigate('/privacy')} className="hover:underline cursor-pointer bg-transparent border-none text-[#6b7280] text-[0.85rem]">Privacidade</button>
            <button onClick={() => navigate('/termos')} className="hover:underline cursor-pointer bg-transparent border-none text-[#6b7280] text-[0.85rem]">Termos de Uso</button>
          </div>
          <p className="mt-3 text-xs text-gray-400 max-w-[520px] mx-auto leading-relaxed">
            Ao ativar o sistema, você confirma que possui autorização para contatar seus clientes via WhatsApp conforme a LGPD. Todas as mensagens incluem opção de descadastro.
          </p>
        </div>
      </footer>
    </div>
  )
}
