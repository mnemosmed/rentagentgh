import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StarRating } from './StarRating';
import { Quote } from 'lucide-react';

interface Testimonial {
  id: string;
  display_name: string | null;
  rating: number | null;
  going_well: string | null;
  improvement: string | null;
  submitted_at: string;
}

export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('user_feedback')
        .select('id, display_name, rating, going_well, improvement, submitted_at')
        .eq('is_published', true)
        .order('submitted_at', { ascending: false })
        .limit(6);
      setTestimonials((data as Testimonial[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading || testimonials.length === 0) return null;

  const firstName = (name: string | null) => {
    if (!name) return 'A renter';
    return name.split(' ')[0];
  };

  return (
    <section className="py-20 md:py-32 relative overflow-hidden" aria-labelledby="testimonials-heading">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="container relative">
        <header className="text-center mb-16 max-w-2xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            What renters say
          </span>
          <h2 id="testimonials-heading" className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            Real feedback from{' '}
            <span className="text-gradient">real house hunters.</span>
          </h2>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((t) => {
            const quote = t.going_well || t.improvement || '';
            return (
              <article
                key={t.id}
                className="group relative p-6 rounded-3xl bg-background border border-border/50 shadow-lg hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300"
              >
                <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10 group-hover:text-primary/20 transition-colors" />
                {t.rating && <StarRating rating={t.rating} size="sm" />}
                <p className="text-foreground leading-relaxed mt-3 mb-4 line-clamp-5">"{quote}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                    {firstName(t.display_name).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{firstName(t.display_name)}</p>
                    <p className="text-xs text-muted-foreground">Verified renter</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
