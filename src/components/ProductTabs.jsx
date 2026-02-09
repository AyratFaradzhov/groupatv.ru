import { motion } from "framer-motion";
import { useState } from "react";
import "./ProductTabs.css";

const TABS = [
  { id: "products", label: "Продукция" },
  { id: "brands", label: "Бренды" },
];

export default function ProductTabs({ onChange }) {
  const [activeTab, setActiveTab] = useState("products");

  const handleClick = (id) => {
    setActiveTab(id);
    onChange?.(id);
  };

  return (
    <div className="product-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className="product-tab"
          onClick={() => handleClick(tab.id)}
        >
          {tab.label}

          {activeTab === tab.id && (
            <motion.div
              layoutId="active-pill"
              className="product-tab__indicator"
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 28,
                mass: 0.6,
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
