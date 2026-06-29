import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AreaSearch } from '@/components/AreaSearch';
import { Navbar } from '@/components/Navbar';
import logo from '@/assets/logo.png';
import residential1 from '@/assets/residential-1.jpg';
import residential2 from '@/assets/residential-2.jpg';
import residential3 from '@/assets/residential-3.jpg';
import { 
  Search, 
  MessageCircle, 
  User, 
  Phone,
  MapPin,
  Clock,
  XCircle,
  Users,
  CheckCircle,
  Shield,
  ArrowRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import { SEO } from '@/components/SEO';

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I find a rental agent in Accra?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Use RentAgentGhana to search for rental agents by neighborhood. Enter your preferred area like East Legon, Cantonments, or Airport Residential, and browse agents who actively work in that location.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is RentAgentGhana free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, RentAgentGhana is completely free for renters. You can search for agents, view their profiles, and send messages at no cost.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which areas in Accra are covered?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'RentAgentGhana covers all major neighborhoods in Accra including East Legon, Cantonments, Airport Residential, Osu, Labone, Dzorwulu, Roman Ridge, Tema, Spintex, and many more.',
      },
    },
  ],
};

const Index = () => {
  const [searchValue, setSearchValue] = useState('');
  const navigate = useNavigate();

  const handleSearch = () => {
    if (searchValue) {
      navigate(`/search?area=${encodeURIComponent(searchValue)}`);
    } else {
      navigate('/search');
    }
  };

  const problems = [
    { icon: Search, text: "You find listings on multiple platforms… then you start chasing agents." },
    { icon: Phone, text: "You save countless numbers just to follow up." },
    { icon: MessageCircle, text: "You repeat the same request again and again." },
    { icon: Clock, text: "You get delayed replies — or no replies." },
    { icon: XCircle, text: "You don't know which agents actually work in your area." },
  ];

  const solutions = [
    { icon: MapPin, text: "Find agents by town/suburb" },
    { icon: MessageCircle, text: "Send your requirements in seconds" },
    { icon: Users, text: "Keep conversations on the platform" },
    { icon: ArrowRight, text: "Move forward when you're ready" },
  ];

  const steps = [
    { number: 1, title: "Search by area", description: "Enter your preferred neighborhood", icon: Search },
    { number: 2, title: "Choose an agent", description: "Browse agents who serve your area", icon: User },
    { number: 3, title: "Send a structured request", description: "Budget, rooms, move-in date", icon: MessageCircle },
    { number: 4, title: "Get replies and take it from there", description: "Call, viewing, etc.", icon: Zap },
  ];

  const trustPoints = [
    { icon: MessageCircle, text: "Conversations happen on-platform for clarity" },
    { icon: Shield, text: "Agents can claim and verify profiles over time" },
    { icon: CheckCircle, text: "No payments required to get started" },
  ];

  return (
    <main className="min-h-screen bg-background overflow-hidden" role="main">
      <SEO
        title="RentAgentGhana — Find Rental Agents in Accra"
        description="Find trusted rental agents in Accra by neighborhood — East Legon, Cantonments, Osu and more. No listings, no spam, just real agents who respond."
        path="/"
        jsonLd={FAQ_JSONLD}
      />
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 md:pt-36 md:pb-32" aria-labelledby="hero-heading">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-primary/15 via-purple-300/10 to-transparent blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-r from-primary/5 via-accent/10 to-primary/5 blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="container relative">
          <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium opacity-0 animate-fade-in">
                <Sparkles className="h-4 w-4" />
                The smarter way to find rent agents
              </div>

              <h1 id="hero-heading" className="font-display text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-extrabold text-foreground leading-[1.1] tracking-tight opacity-0 animate-fade-in delay-100">
                Stop saving{' '}
                <span className="relative">
                  <span className="text-gradient">20+ agent numbers</span>
                  <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/30" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 7 Q50 0 100 7 Q150 14 200 7" stroke="currentColor" strokeWidth="3" fill="none" />
                  </svg>
                </span>{' '}
                just to find one apartment.
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed opacity-0 animate-fade-in delay-200">
                RentAgentGhana helps you find rent agents by the areas they actually work in and message them instantly — all in one place.
              </p>
              
              {/* Search Box */}
              <div className="max-w-xl mx-auto lg:mx-0 pt-4 opacity-0 animate-fade-in delay-300">
                <div className="relative p-2 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl shadow-primary/10">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <AreaSearch
                      value={searchValue}
                      onChange={setSearchValue}
                      onSearch={handleSearch}
                      placeholder="Enter area, e.g. East Legon"
                      className="flex-1"
                      onInputFocus={() => navigate('/search')}
                    />
                    <Button 
                      size="lg" 
                      onClick={handleSearch} 
                      className="h-14 px-8 text-lg gap-2 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25"
                    >
                      Find agents
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground pt-2 opacity-0 animate-fade-in delay-400 font-medium">
                A phone book for rent agents — <span className="text-primary">on steroids</span>.
              </p>
            </div>

            {/* Right Column - Image Collage */}
            <div className="relative hidden lg:block opacity-0 animate-fade-in delay-200">
              <div className="relative h-[500px]">
                {/* Main large image - top right */}
                <div className="absolute top-0 right-0 w-[70%] h-[50%] rounded-3xl overflow-hidden shadow-2xl shadow-primary/20 border-4 border-background z-10 hover:scale-[1.02] transition-transform duration-500">
                  <img 
                    src={residential2} 
                    alt="Luxury residential compound in Ghana" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
                </div>
                
                {/* Bottom left image */}
                <div className="absolute bottom-0 left-0 w-[48%] h-[45%] rounded-3xl overflow-hidden shadow-2xl shadow-primary/20 border-4 border-background z-20 hover:scale-[1.02] transition-transform duration-500">
                  <img 
                    src={residential1} 
                    alt="Modern apartment building in Accra" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
                </div>
                
                {/* Bottom right small image */}
                <div className="absolute bottom-0 right-0 w-[45%] h-[40%] rounded-2xl overflow-hidden shadow-xl shadow-primary/15 border-4 border-background z-30 hover:scale-[1.02] transition-transform duration-500">
                  <img 
                    src={residential3} 
                    alt="Aerial view of residential neighborhood" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 blur-2xl" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-gradient-to-tr from-accent/30 to-primary/30 blur-2xl" />
              </div>
            </div>
          </div>

          {/* Mobile Image Strip */}
          <div className="lg:hidden mt-12 opacity-0 animate-fade-in delay-300">
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
              <div className="flex-shrink-0 w-64 h-40 rounded-2xl overflow-hidden shadow-lg">
                <img src={residential1} alt="Modern apartment" className="w-full h-full object-cover" />
              </div>
              <div className="flex-shrink-0 w-64 h-40 rounded-2xl overflow-hidden shadow-lg">
                <img src={residential2} alt="Luxury compound" className="w-full h-full object-cover" />
              </div>
              <div className="flex-shrink-0 w-64 h-40 rounded-2xl overflow-hidden shadow-lg">
                <img src={residential3} alt="Residential area" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 md:py-32 relative" aria-labelledby="problem-heading">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <div className="container relative">
          <div className="max-w-4xl mx-auto">
            <header className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm font-semibold mb-4">
                The Problem
              </span>
              <h2 id="problem-heading" className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
                Listings are easy.{' '}
                <span className="block mt-2 text-muted-foreground">The real stress starts after.</span>
              </h2>
            </header>
            
            <ul className="grid gap-4" role="list">
              {problems.map((problem, index) => (
                <li 
                  key={index}
                  className="group flex items-start gap-5 p-5 md:p-6 rounded-2xl bg-background border border-border/50 shadow-sm hover:shadow-xl hover:shadow-destructive/5 hover:border-destructive/20 transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-destructive/10 to-destructive/5 group-hover:from-destructive/20 group-hover:to-destructive/10 transition-colors" aria-hidden="true">
                    <problem.icon className="h-5 w-5 text-destructive" />
                  </div>
                  <p className="text-foreground text-lg leading-relaxed">{problem.text}</p>
                </li>
              ))}
            </ul>
            
            <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-muted/50 via-muted to-muted/50 border border-border/50 text-center">
              <p className="text-xl text-foreground font-medium">
                The issue isn't only the properties. <span className="text-primary font-bold">It's coordination.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution / Differentiator Section */}
      <section className="py-20 md:py-32 relative overflow-hidden" aria-labelledby="solution-heading">
        {/* Background decoration */}
        <div className="absolute top-1/2 left-0 w-96 h-96 rounded-full bg-gradient-to-r from-primary/10 to-transparent blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-gradient-to-l from-accent/10 to-transparent blur-3xl -translate-y-1/2" />
        
        <div className="container relative">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                The Solution
              </span>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                We flipped the process:{' '}
                <span className="text-gradient">start with the agent.</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Agents are the gateway to rentals. RentAgentGhana helps you find the right agent for your area and start the conversation properly.
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-5">
              {solutions.map((solution, index) => (
                <div 
                  key={index}
                  className="group relative p-6 rounded-2xl bg-gradient-to-br from-primary/5 via-background to-accent/5 border border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-4">
                    <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25">
                      <solution.icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <p className="text-foreground font-semibold text-lg">{solution.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30" aria-labelledby="how-it-works-heading">
        <div className="container">
          <header className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              How It Works
            </span>
            <h2 id="how-it-works-heading" className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Four simple steps
            </h2>
          </header>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="group relative"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
                )}
                
                <div className="relative text-center p-8 rounded-3xl bg-background border border-border/50 shadow-lg shadow-primary/5 h-full transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-primary/15 group-hover:border-primary/30 group-hover:-translate-y-2">
                  {/* Step number badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center text-sm font-bold shadow-lg shadow-primary/30">
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <step.icon className="h-7 w-7 text-primary" />
                  </div>
                  
                  <h3 className="font-bold text-foreground text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Transparency Section */}
      <section className="py-20 md:py-32 relative" aria-labelledby="trust-heading">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <header className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 text-primary text-sm font-semibold mb-4 border border-primary/20">
                <Shield className="h-4 w-4" aria-hidden="true" />
                Built from Real Experience
              </div>
              <h2 id="trust-heading" className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
                Built from real apartment-hunting{' '}
                <span className="text-gradient">experience in Accra.</span>
              </h2>
            </header>
            
            <div className="grid md:grid-cols-3 gap-6">
              {trustPoints.map((point, index) => (
                <div 
                  key={index}
                  className="group p-6 rounded-2xl bg-gradient-to-br from-background to-muted/50 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 text-center"
                >
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <point.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-foreground font-medium">{point.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials from real renters */}
      <TestimonialsSection />

      {/* Final CTA */}
      <section className="py-20 md:py-32 relative overflow-hidden" aria-labelledby="cta-heading">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[500px] h-[500px] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
        </div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 id="cta-heading" className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground leading-tight">
              Ready to find agents in your area?
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-xl mx-auto">
              Stop the endless chase. Start with the right agent.
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate('/search')}
              className="h-16 px-10 text-xl gap-3 rounded-2xl font-bold transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg"
            >
              Search by location
              <ArrowRight className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border bg-muted/30">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="RentAgentGhana" className="h-10 w-10 object-contain" />
              <div>
                <span className="font-bold text-foreground">RentAgentGhana</span>
                <p className="text-sm text-muted-foreground">© 2026 All rights reserved.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.youtube.com/@rentagentghana" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@rentagentghana" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.1a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.01.47z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Index;
