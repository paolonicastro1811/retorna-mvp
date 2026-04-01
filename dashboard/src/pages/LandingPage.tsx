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
      <section className="relative min-h-[60vh] flex items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/hero.png')] bg-center bg-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 max-w-[720px] mx-auto px-6 py-12">
          <p className="text-xs font-bold tracking-widest uppercase text-white/80 mb-3">Para restaurantes</p>
          <h1 className="text-[clamp(1.8rem,5vw,2.6rem)] font-extrabold leading-tight text-white mb-5 [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
            Seus clientes ja existem.<br /><span className="text-[#25D366]">Eles so pararam de voltar.</span>
          </h1>
          <p className="text-lg text-white/90 max-w-[520px] mx-auto mb-9 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
            Recupere clientes inativos via WhatsApp e veja exatamente quanto faturamento eles geram quando voltam.
          </p>
          <button
            onClick={() => navigate('/comecar')}
            className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-9 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
          >
            <WhatsAppIcon size={22} />
            Quero trazer meus clientes de volta
          </button>
          <span className="block mt-2.5 text-sm text-white/60">Sem setup complicado · Funciona em poucos dias</span>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-12 bg-[#f8f9fb]">
        <div className="max-w-[960px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-[5fr_6fr] gap-7 items-center">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">O problema</p>
              <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-7">
                Voce esta perdendo faturamento<br />todos os dias — sem perceber
              </h2>
              <ul className="space-y-4">
                {[
                  'Voce ja investiu para conquistar esses clientes',
                  'Muitos vieram uma ou duas vezes e nunca mais voltaram',
                  'Ninguem faz follow-up com quem sumiu',
                  'Cada cliente inativo e dinheiro que voce deixa na mesa',
                  'Voce nao tem como saber quanto esta perdendo',
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 font-extrabold text-xl leading-6">×</span>
                    <span className="text-[1.05rem]">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <img src="/images/empty.png" alt="Restaurante vazio" className="w-full rounded-xl shadow-lg object-cover" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* SOLUCAO */}
      <section className="py-12">
        <div className="max-w-[720px] mx-auto px-6">
          <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">A solucao</p>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-7">
            Um sistema simples que traz<br />seus clientes de volta
          </h2>
          <div className="space-y-4">
            {[
              'Ative seu numero de WhatsApp em poucos minutos',
              'Importe seus clientes e historico de visitas',
              'O sistema identifica quem nao voltou ha mais de 30 dias',
              'Envia mensagens WhatsApp automaticamente para eles',
              'Voce ve quem voltou e quanto gastou — em reais',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-3.5 text-[1.05rem]">
                <CheckIcon />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-12 bg-[#f8f9fb]">
        <div className="max-w-[720px] mx-auto px-6 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Como funciona</p>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-7">3 passos. Sem complicacao.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { n: '1', h: 'Conecte seu WhatsApp', p: 'Vincule o numero do seu restaurante em poucos minutos.' },
              { n: '2', h: 'Sistema encontra clientes inativos', p: 'O sistema identifica automaticamente quem parou de voltar.' },
              { n: '3', h: 'Veja quem voltou e quanto gastou', p: 'Acompanhe o retorno e o faturamento gerado.' },
            ].map(s => (
              <div key={s.n} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#1a1a2e] text-white text-xl font-extrabold inline-flex items-center justify-center mb-3.5">{s.n}</div>
                <h3 className="text-[1.05rem] font-bold text-[#1a1a2e] mb-1.5">{s.h}</h3>
                <p className="text-sm text-[#6b7280]">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA */}
      <section className="py-12 text-center">
        <div className="max-w-[960px] mx-auto px-6">
          <p className="text-xs font-bold tracking-widest uppercase text-[#0f9d58] mb-3">Resultados reais</p>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-[#1a1a2e] mb-3">
            Veja o que acontece quando voce reativa seus clientes
          </h2>
          <p className="text-[#6b7280] mb-6">Exemplo real de campanha Retorna</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center max-w-[860px] mx-auto text-left">
            <img src="/images/full.png" alt="Restaurante cheio" className="w-full rounded-xl shadow-lg object-cover" loading="lazy" />
            <div className="bg-[#1a1a2e] text-white rounded-xl p-8 md:p-10">
              <p className="text-xs font-bold tracking-wider uppercase text-white/50 mb-7">Exemplo real de campanha</p>
              {[
                { label: 'Clientes contatados', value: '120', highlight: false },
                { label: 'Clientes que voltaram', value: '18', highlight: false },
                { label: 'Faturamento gerado', value: 'R$ 2.350', highlight: true },
              ].map((r, i) => (
                <div key={i} className={`flex justify-between items-baseline py-3.5 ${i < 2 ? 'border-b border-white/10' : ''}`}>
                  <span className="text-[0.95rem] text-white/75">{r.label}</span>
                  <span className={`font-extrabold ${r.highlight ? 'text-[#25D366] text-2xl' : 'text-xl'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="text-center py-10 pb-14">
        <div className="max-w-[720px] mx-auto px-6">
          <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-extrabold text-[#1a1a2e] mb-3">
            Pare de perder clientes<br />todos os dias
          </h2>
          <p className="text-[#6b7280] mb-8 text-[1.05rem]">Ative o sistema e comece a recuperar faturamento ja.</p>
          <button
            onClick={() => navigate('/comecar')}
            className="inline-flex items-center gap-2.5 bg-[#25D366] text-white text-lg font-bold py-4 px-9 rounded-full hover:bg-[#1DA851] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
          >
            <WhatsAppIcon size={22} />
            Quero trazer meus clientes de volta
          </button>
          <span className="block mt-2.5 text-sm text-[#6b7280]">Teste inicial · Sem compromisso</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-6 text-[0.8rem] text-[#6b7280] border-t border-gray-200">
        <div className="max-w-[720px] mx-auto px-6">
          Retorna &copy; 2026 &middot; Todos os direitos reservados
          <div className="mt-2 space-x-4">
            <button onClick={() => navigate('/privacy')} className="hover:underline cursor-pointer bg-transparent border-none text-[#6b7280] text-[0.8rem]">Privacidade</button>
            <button onClick={() => navigate('/termos')} className="hover:underline cursor-pointer bg-transparent border-none text-[#6b7280] text-[0.8rem]">Termos de Uso</button>
          </div>
          <p className="mt-3 text-[0.68rem] text-gray-400 max-w-[480px] mx-auto leading-relaxed">
            Ao ativar o sistema, voce confirma que possui autorizacao para contatar seus clientes via WhatsApp conforme a LGPD. Todas as mensagens incluem opcao de descadastro.
          </p>
        </div>
      </footer>
    </div>
  )
}
