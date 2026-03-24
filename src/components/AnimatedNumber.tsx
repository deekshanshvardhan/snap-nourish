import { useEffect, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";

interface Props {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const AnimatedNumber = ({ value, className, prefix = "", suffix = "" }: Props) => {
  const [display, setDisplay] = useState(0);
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { damping: 30, stiffness: 200 });

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => setDisplay(Math.round(v)));
    return unsubscribe;
  }, [spring]);

  return <span className={className}>{prefix}{display}{suffix}</span>;
};

export default AnimatedNumber;
