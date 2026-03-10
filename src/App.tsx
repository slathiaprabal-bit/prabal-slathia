import React from "react";
import { motion, Variants, useScroll } from "motion/react";
import { 
  Leaf, 
  ShoppingCart, 
  Recycle, 
  ShieldCheck, 
  Sparkles, 
  Globe, 
  Mail, 
  Instagram, 
  Twitter, 
  Facebook,
  ArrowRight,
  Droplets,
  Shield,
  Heart,
  Thermometer,
  MessageCircle,
  Share2,
  Check,
  X,
  ArrowDown
} from "lucide-react";

// Advanced Animation Variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 150, filter: "blur(10px)" },
  visible: { 
    opacity: 1, 
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 2.2, ease: [0.16, 1, 0.3, 1] }
  }
};

const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -250, filter: "blur(10px)" },
  visible: { 
    opacity: 1, 
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 2.5, ease: [0.16, 1, 0.3, 1] }
  }
};

const slideInRight: Variants = {
  hidden: { opacity: 0, x: 250, filter: "blur(10px)" },
  visible: { 
    opacity: 1, 
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 2.5, ease: [0.16, 1, 0.3, 1] }
  }
};

const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.6, filter: "blur(20px)" },
  visible: { 
    opacity: 1, 
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 2.8, ease: [0.16, 1, 0.3, 1] }
  }
};

const revealMask: Variants = {
  hidden: { clipPath: "inset(100% 0% 0% 0%)" },
  visible: { 
    clipPath: "inset(0% 0% 0% 0%)",
    transition: { duration: 2.5, ease: [0.16, 1, 0.3, 1] }
  }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const SectionReveal = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.2 }}
    variants={staggerContainer}
    className={className}
  >
    {children}
  </motion.div>
);

const Navbar = () => {
  const { scrollYProgress } = useScroll();
  
  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 bg-[#faf8f5]/80 backdrop-blur-md border-b border-[#3d5a3d]/10 px-6 lg:px-20 py-4"
    >
      <motion.div 
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3d5a3d] origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      <div className="max-w-7xl mx-auto flex items-center justify-between whitespace-nowrap">
        <div className="flex items-center gap-3 text-[#2a2a2a]">
          <div className="text-[#3d5a3d]">
            <Leaf className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold leading-tight tracking-tight">Bambū</h2>
        </div>
        <nav className="hidden md:flex flex-1 justify-center gap-10">
          {["Shop", "Story", "Sustainability", "Contact"].map((item) => (
            <a key={item} className="text-sm font-medium hover:text-[#3d5a3d] transition-colors relative group" href="#">
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#3d5a3d] transition-all group-hover:w-full" />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <button className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-full h-10 px-5 bg-[#3d5a3d] text-white text-sm font-bold transition-transform hover:scale-105 active:scale-95">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Cart
          </button>
        </div>
      </div>
    </motion.header>
  );
};

const Hero = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden bg-[#faf8f5]">
    <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]" />
    <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full py-20">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="order-2 lg:order-1"
        >
          <motion.div variants={fadeInUp} className="flex items-center gap-2 mb-6">
            <Leaf className="w-4 h-4 text-[#5a7a5a]" />
            <span className="text-xs tracking-[0.2em] uppercase text-[#5a7a5a] font-medium">Sustainable Living</span>
          </motion.div>
          <div className="overflow-hidden">
            <motion.h1 variants={fadeInUp} className="text-6xl md:text-7xl lg:text-9xl font-light text-[#2a2a2a] leading-[0.9] tracking-tighter">
              Drink<br />
              <span className="font-semibold text-[#3d5a3d]">Naturally.</span>
            </motion.h1>
          </div>
          <motion.p variants={fadeInUp} className="mt-8 text-xl text-[#6b6b6b] leading-relaxed max-w-md font-light">
            Crafted from organic bamboo, our bottles are a statement — for the planet, for your health, for a future worth believing in.
          </motion.p>
          <motion.div variants={fadeInUp} className="mt-10 flex flex-wrap gap-4">
            <button className="px-10 py-5 bg-[#3d5a3d] text-white text-base font-bold tracking-wide rounded-full hover:bg-[#2e472e] transition-all duration-300 hover:shadow-2xl hover:shadow-[#3d5a3d]/30 hover:-translate-y-1">
              Shop Now
            </button>
            <button className="px-10 py-5 border-2 border-[#d4cfc7] text-[#4a4a4a] text-base font-bold tracking-wide rounded-full hover:border-[#3d5a3d] hover:text-[#3d5a3d] transition-all duration-300">
              Learn More
            </button>
          </motion.div>
          <motion.div variants={staggerContainer} className="mt-16 flex items-center gap-12">
            {[
              { val: "100%", label: "Biodegradable" },
              { val: "Zero", label: "Plastic Used" },
              { val: "24hr", label: "Temp Retention" }
            ].map((stat, i) => (
              <React.Fragment key={i}>
                <motion.div variants={fadeInUp}>
                  <p className="text-4xl font-black text-[#2a2a2a]">{stat.val}</p>
                  <p className="text-xs text-[#8a8a8a] mt-1 tracking-widest uppercase font-bold">{stat.label}</p>
                </motion.div>
                {i < 2 && <div className="w-px h-12 bg-[#e0dbd3]" />}
              </React.Fragment>
            ))}
          </motion.div>
        </motion.div>
        
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={revealMask}
          className="order-1 lg:order-2 flex justify-center"
        >
          <div className="relative">
            <motion.div 
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -inset-20 bg-gradient-to-br from-[#e8e2d8]/80 to-transparent rounded-full blur-3xl" 
            />
            <motion.img 
              animate={{ 
                y: [0, -30, 0],
                rotate: [0, 2, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              src="https://media.base44.com/images/public/69b05bfe020f4f9fced48674/19a84eb59_generated_4595ae0c.png" 
              alt="Premium bamboo water bottle" 
              className="relative w-full max-w-lg rounded-[3rem] shadow-[0_80px_150px_-30px_rgba(42,42,42,0.3)]"
            />
          </div>
        </motion.div>
      </div>
    </div>
    <motion.div 
      className="absolute bottom-10 left-1/2 -translate-x-1/2"
      animate={{ y: [0, 15, 0] }}
      transition={{ duration: 2.5, repeat: Infinity }}
    >
      <ArrowDown className="w-6 h-6 text-[#b0a89e]" />
    </motion.div>
  </section>
);

const Features = () => {
  const features = [
    { icon: Droplets, title: "Naturally Antibacterial", desc: "Bamboo contains bio-agent 'Bamboo Kun' which resists bacteria growth — keeping your water fresh and pure." },
    { icon: Shield, title: "BPA & Toxin Free", desc: "No harmful chemicals leaching into your drinks. Just clean, safe hydration every single time." },
    { icon: Recycle, title: "100% Biodegradable", desc: "When its journey ends, it returns to the earth. No microplastics. No landfill guilt." },
    { icon: Heart, title: "Lightweight & Durable", desc: "Stronger than you'd think, lighter than you'd expect. Built to be your everyday companion." },
    { icon: Thermometer, title: "Temperature Insulated", desc: "Double-wall design keeps cold drinks cold for 12hrs and hot drinks hot for 8hrs." },
    { icon: Sparkles, title: "Unique Aesthetic", desc: "Every bottle has its own natural grain pattern. No two are exactly alike — just like you." }
  ];

  return (
    <section className="py-40 px-6 lg:px-12 bg-white">
      <SectionReveal className="max-w-7xl mx-auto">
        <motion.div variants={fadeInUp} className="text-center mb-32">
          <span className="text-xs tracking-[0.4em] uppercase text-[#5a7a5a] font-black">The Bamboo Advantage</span>
          <h2 className="mt-8 text-6xl md:text-8xl font-light text-[#2a2a2a] tracking-tighter leading-none">Why <span className="font-semibold text-[#3d5a3d]">Bamboo?</span></h2>
          <p className="mt-8 text-2xl text-[#8a8a8a] max-w-3xl mx-auto leading-relaxed font-light">Nature already designed the perfect material. We just shaped it into a bottle.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {features.map((item, idx) => (
            <motion.div 
              key={idx}
              variants={fadeInUp}
              whileHover={{ y: -20, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }}
              className="group p-12 rounded-[3rem] border border-[#f0ece6] hover:border-[#3d5a3d]/30 hover:shadow-[0_60px_100px_-30px_rgba(61,90,61,0.15)] transition-all duration-700 bg-[#faf8f5]/50"
            >
              <div className="w-20 h-20 rounded-3xl bg-[#f0ece6] flex items-center justify-center group-hover:bg-[#3d5a3d] group-hover:rotate-[10deg] transition-all duration-700">
                <item.icon className="w-10 h-10 text-[#5a7a5a] group-hover:text-white transition-colors duration-700" />
              </div>
              <h3 className="mt-10 text-3xl font-bold text-[#2a2a2a] tracking-tight">{item.title}</h3>
              <p className="mt-6 text-xl text-[#8a8a8a] leading-relaxed font-light">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </SectionReveal>
    </section>
  );
};

const Comparison = () => {
  const rows = [
    { feature: "Biodegradable", bamboo: true, plastic: false },
    { feature: "BPA Free", bamboo: true, plastic: false },
    { feature: "Naturally Antibacterial", bamboo: true, plastic: false },
    { feature: "Reusable 1000+ times", bamboo: true, plastic: false },
    { feature: "Unique Natural Texture", bamboo: true, plastic: false },
    { feature: "Safe for Hot Drinks", bamboo: true, plastic: false },
    { feature: "Microplastic Leaching", bamboo: false, plastic: true },
    { feature: "Takes 450 Years to Decompose", bamboo: false, plastic: true }
  ];

  return (
    <section className="py-40 px-6 lg:px-12 bg-[#faf8f5] overflow-hidden">
      <SectionReveal className="max-w-7xl mx-auto">
        <motion.div variants={fadeInUp} className="text-center mb-32">
          <span className="text-xs tracking-[0.4em] uppercase text-[#5a7a5a] font-black">The Better Choice</span>
          <h2 className="mt-8 text-6xl md:text-8xl font-light text-[#2a2a2a] tracking-tighter leading-none">Bamboo <span className="font-semibold text-[#3d5a3d]">vs Plastic</span></h2>
          <p className="mt-8 text-2xl text-[#8a8a8a] max-w-3xl mx-auto leading-relaxed font-light">The numbers don't lie. The planet can't wait. Make the switch.</p>
        </motion.div>

        <motion.div 
          variants={revealMask}
          className="mb-32 rounded-[4rem] overflow-hidden shadow-[0_80px_150px_-30px_rgba(0,0,0,0.2)]"
        >
          <motion.img 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            src="https://media.base44.com/images/public/69b05bfe020f4f9fced48674/655958fce_generated_9d01754c.png" 
            alt="Comparison" 
            className="w-full h-[600px] object-cover"
          />
        </motion.div>

        <motion.div 
          variants={fadeInUp}
          className="bg-white rounded-[4rem] border border-[#f0ece6] overflow-hidden shadow-[0_100px_200px_-50px_rgba(0,0,0,0.1)]"
        >
          <div className="grid grid-cols-3 text-center border-b border-[#f0ece6] bg-[#faf8f5]/50">
            <div className="p-10 text-left"><span className="text-sm font-black uppercase tracking-[0.3em] text-[#8a8a8a]">Feature</span></div>
            <div className="p-10 bg-[#3d5a3d]/5"><span className="text-sm font-black uppercase tracking-[0.3em] text-[#3d5a3d]">🎋 Bamboo</span></div>
            <div className="p-10"><span className="text-sm font-black uppercase tracking-[0.3em] text-[#8a8a8a]">🪣 Plastic</span></div>
          </div>
          {rows.map((row, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + idx * 0.1, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true }}
              className={`grid grid-cols-3 text-center group hover:bg-[#faf8f5] transition-colors duration-500 ${idx < rows.length - 1 ? "border-b border-[#f0ece6]" : ""}`}
            >
              <div className="p-8 text-left"><span className="text-xl text-[#4a4a4a] font-medium group-hover:text-[#2a2a2a] transition-colors">{row.feature}</span></div>
              <div className="p-8 bg-[#3d5a3d]/5 flex justify-center items-center">
                {row.bamboo ? (
                  <motion.div 
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.1, type: "spring" }}
                    className="w-10 h-10 rounded-full bg-[#3d5a3d] flex items-center justify-center shadow-xl shadow-[#3d5a3d]/30"
                  >
                    <Check className="w-6 h-6 text-white" />
                  </motion.div>
                ) : (
                  <X className="w-8 h-8 text-[#c0b8ac]" />
                )}
              </div>
              <div className="p-8 flex justify-center items-center">
                {row.plastic ? (
                  <motion.div 
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.1, type: "spring" }}
                    className="w-10 h-10 rounded-full bg-red-400 flex items-center justify-center shadow-xl shadow-red-400/30"
                  >
                    <Check className="w-6 h-6 text-white" />
                  </motion.div>
                ) : (
                  <X className="w-8 h-8 text-red-300" />
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </SectionReveal>
    </section>
  );
};

const Impact = () => {
  const stats = [
    { number: "8M+", label: "Tons of plastic enter oceans yearly", color: "text-red-500" },
    { number: "500B", label: "Plastic bottles produced each year", color: "text-[#2a2a2a]" },
    { number: "91%", label: "Of plastic is never recycled", color: "text-[#2a2a2a]" },
    { number: "1", label: "Bamboo bottle = 200+ plastic ones saved", color: "text-[#3d5a3d]" }
  ];

  return (
    <section className="py-40 px-6 lg:px-12 bg-white overflow-hidden">
      <SectionReveal className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-32 items-center">
          <motion.div 
            variants={slideInLeft}
            className="relative"
          >
            <motion.div 
              animate={{ rotate: [0, 5, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-12 bg-gradient-to-tr from-[#3d5a3d]/20 to-transparent rounded-[4rem] blur-3xl" 
            />
            <motion.img 
              variants={revealMask}
              src="https://media.base44.com/images/public/69b05bfe020f4f9fced48674/3a75326e7_generated_79e60b9c.png" 
              alt="Eco Impact" 
              className="relative rounded-[4rem] shadow-2xl w-full object-cover aspect-[4/5]"
            />
          </motion.div>
          
          <motion.div 
            variants={slideInRight}
            className="flex flex-col gap-12"
          >
            <span className="text-[#3d5a3d] font-black tracking-[0.4em] uppercase text-sm">Eco Impact</span>
            <h2 className="text-6xl md:text-8xl font-light text-[#2a2a2a] tracking-tighter leading-[0.9] overflow-hidden">
              Every Sip <br />
              <span className="font-semibold text-[#3d5a3d]">Saves the Planet</span>
            </h2>
            <p className="text-2xl text-[#6b6b6b] leading-relaxed font-light">The plastic crisis is real. But so is the solution. By choosing bamboo, you're not just buying a bottle — you're voting for a cleaner ocean, healthier soil, and a future where nature thrives.</p>
            
            <div className="grid grid-cols-2 gap-12">
              {stats.map((stat, idx) => (
                <motion.div 
                  key={idx}
                  variants={fadeInUp}
                >
                  <p className={`text-6xl font-black ${stat.color} tracking-tighter`}>{stat.number}</p>
                  <p className="mt-4 text-sm text-[#8a8a8a] leading-relaxed font-bold uppercase tracking-[0.2em]">{stat.label}</p>
                </motion.div>
              ))}
            </div>
            
            <motion.div 
              variants={fadeInUp}
              whileHover={{ scale: 1.02, rotate: -1 }}
              className="mt-8 p-10 rounded-[3rem] bg-[#3d5a3d]/5 border border-[#3d5a3d]/10 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#3d5a3d]/10 blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
              <p className="text-xl text-[#3d5a3d] leading-relaxed italic font-medium relative z-10">
                "Bamboo is the fastest growing plant on Earth — growing up to 3 feet per day. It requires no pesticides, little water, and absorbs 35% more CO₂ than trees."
              </p>
            </motion.div>
          </motion.div>
        </div>
      </SectionReveal>
    </section>
  );
};

const Social = () => {
  const posts = [
    { img: "https://media.base44.com/images/public/69b05bfe020f4f9fced48674/977d3314f_generated_a5f2a0a1.png", caption: "Nature's design. Zero compromise. 🎋", likes: "12.4K", comments: "847" },
    { img: "https://media.base44.com/images/public/69b05bfe020f4f9fced48674/60225d35d_generated_d12d0f4c.png", caption: "One bottle. Infinite refills. Zero plastic. 🌍", likes: "8.9K", comments: "623" }
  ];

  return (
    <section className="py-40 px-6 lg:px-12 bg-[#faf8f5]">
      <SectionReveal className="max-w-7xl mx-auto">
        <motion.div variants={fadeInUp} className="text-center mb-32">
          <span className="text-xs tracking-[0.4em] uppercase text-[#5a7a5a] font-black">Join The Movement</span>
          <h2 className="mt-8 text-6xl md:text-8xl font-light text-[#2a2a2a] tracking-tighter leading-none">Share Your <span className="font-semibold text-[#3d5a3d]">Story</span></h2>
          <p className="mt-8 text-2xl text-[#8a8a8a] max-w-3xl mx-auto leading-relaxed font-light">Post your bamboo bottle moment and tag us. Together, we're building a plastic-free future.</p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-6 mb-32">
          {["#DrinkNaturally", "#BambooBottle", "#DitchPlastic", "#EcoFriendly", "#SustainableLiving", "#ZeroWaste", "#GreenRevolution", "#NaturalHydration"].map((tag, i) => (
            <motion.span 
              key={tag}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.1, backgroundColor: "#3d5a3d", color: "#fff", rotate: i % 2 === 0 ? 5 : -5 }}
              className="px-8 py-4 rounded-full bg-white border border-[#e8e2d8] text-base text-[#3d5a3d] font-bold transition-all cursor-pointer shadow-md"
            >
              {tag}
            </motion.span>
          ))}
        </motion.div>

        <div className="grid md:grid-cols-2 gap-16 max-w-6xl mx-auto">
          {posts.map((post, idx) => (
            <motion.div 
              key={idx}
              variants={idx % 2 === 0 ? slideInLeft : slideInRight}
              className="bg-white rounded-[4rem] overflow-hidden border border-[#f0ece6] shadow-2xl hover:-translate-y-4 transition-all duration-700 group"
            >
              <div className="flex items-center gap-5 p-8">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3d5a3d] to-[#7a9e7a] flex items-center justify-center shadow-xl">
                  <span className="text-white text-base font-black">BB</span>
                </div>
                <div>
                  <p className="text-lg font-black text-[#2a2a2a]">bamboobottles</p>
                  <p className="text-xs text-[#8a8a8a] font-bold uppercase tracking-[0.2em]">Sponsored</p>
                </div>
              </div>
              <div className="overflow-hidden">
                <motion.img 
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                  src={post.img} 
                  alt="Post" 
                  className="w-full aspect-square object-cover" 
                />
              </div>
              <div className="p-10">
                <div className="flex items-center gap-8 mb-8">
                  <Heart className="w-8 h-8 text-[#2a2a2a] hover:text-red-500 cursor-pointer transition-colors" />
                  <MessageCircle className="w-8 h-8 text-[#2a2a2a] hover:text-[#3d5a3d] cursor-pointer transition-colors" />
                  <Share2 className="w-8 h-8 text-[#2a2a2a] hover:text-[#3d5a3d] cursor-pointer transition-colors" />
                </div>
                <p className="text-lg font-black text-[#2a2a2a]">{post.likes} likes</p>
                <p className="mt-4 text-lg text-[#4a4a4a] leading-relaxed"><span className="font-black">bamboobottles</span> {post.caption}</p>
                <p className="mt-6 text-base text-[#b0a89e] font-medium cursor-pointer hover:text-[#3d5a3d] transition-colors">View all {post.comments} comments</p>
              </div>
            </motion.div>
          ))}
        </div>
      </SectionReveal>
    </section>
  );
};

const CTA = () => (
  <section className="py-40 px-6 lg:px-12 bg-[#3d5a3d] relative overflow-hidden">
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 90, 0]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#4a6b4a] rounded-full blur-[150px] opacity-30 -translate-y-1/2 translate-x-1/2" 
    />
    <motion.div 
      animate={{ 
        scale: [1, 1.3, 1],
        rotate: [0, -90, 0]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-[#2e472e] rounded-full blur-[150px] opacity-40 translate-y-1/2 -translate-x-1/2" 
    />
    
    <div className="max-w-5xl mx-auto text-center relative z-10">
      <SectionReveal>
        <motion.div variants={fadeInUp} className="flex justify-center mb-12">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-[2rem] bg-white/10 flex items-center justify-center backdrop-blur-2xl border border-white/20"
          >
            <Leaf className="w-12 h-12 text-white" />
          </motion.div>
        </motion.div>
        <motion.h2 variants={fadeInUp} className="text-6xl md:text-9xl font-light text-white tracking-tighter leading-[0.9] mb-10">
          Make the Switch.<br />
          <span className="font-semibold">Save the Planet.</span>
        </motion.h2>
        <motion.p variants={fadeInUp} className="text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed font-light">
          Join thousands who've already chosen bamboo. Your first bottle comes with a promise — for every one sold, we plant a bamboo tree.
        </motion.p>
        
        <motion.div variants={fadeInUp} className="mt-16 flex flex-wrap justify-center gap-8">
          <motion.button 
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.95 }}
            className="group px-14 py-7 bg-white text-[#3d5a3d] text-xl font-black tracking-wide rounded-full shadow-[0_40px_80px_-20px_rgba(255,255,255,0.3)] hover:shadow-white/40 transition-all flex items-center gap-4"
          >
            Get Your Bamboo Bottle
            <ArrowRight className="w-7 h-7 group-hover:translate-x-3 transition-transform" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.95 }}
            className="px-14 py-7 border-2 border-white/30 text-white text-xl font-bold tracking-wide rounded-full hover:bg-white/10 transition-all"
          >
            Follow @bamboobottles
          </motion.button>
        </motion.div>
        
        <motion.p variants={fadeInUp} className="mt-20 text-base text-white/40 font-bold uppercase tracking-[0.3em]">
          🌱 Free shipping on all orders • 30-day return policy • One tree planted per bottle
        </motion.p>
      </SectionReveal>
    </div>
  </section>
);

const Footer = () => (
  <footer className="py-32 px-6 bg-[#2a2a2a] overflow-hidden">
    <SectionReveal className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-16">
      <motion.div variants={fadeInUp} className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#3d5a3d] flex items-center justify-center shadow-xl shadow-[#3d5a3d]/20">
          <Leaf className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl text-white font-black tracking-tighter">Bambū Bottles © 2026</span>
      </motion.div>
      <motion.div variants={staggerContainer} className="flex flex-wrap justify-center items-center gap-12">
        {["Privacy", "Terms", "Contact", "FAQ"].map(item => (
          <motion.span 
            key={item} 
            variants={fadeInUp}
            whileHover={{ scale: 1.1, color: "#fff" }}
            className="text-sm text-white/40 hover:text-white transition-colors tracking-[0.3em] uppercase font-bold cursor-pointer"
          >
            {item}
          </motion.span>
        ))}
      </motion.div>
      <motion.div variants={staggerContainer} className="flex gap-8">
        {[Instagram, Twitter, Facebook].map((Icon, i) => (
          <motion.a 
            key={i}
            variants={fadeInUp}
            whileHover={{ y: -10, color: "#5a7a5a", scale: 1.2 }}
            className="text-white/40 transition-colors" 
            href="#"
          >
            <Icon className="w-8 h-8" />
          </motion.a>
        ))}
      </motion.div>
      <motion.p variants={fadeInUp} className="text-sm text-white/20 font-medium tracking-widest uppercase">Made with 🎋 for the planet</motion.p>
    </SectionReveal>
  </footer>
);

export default function App() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="min-h-screen bg-[#faf8f5] text-[#2a2a2a] selection:bg-[#3d5a3d]/30"
    >
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Comparison />
        <Impact />
        <Social />
        <CTA />
      </main>
      <Footer />
    </motion.div>
  );
}
