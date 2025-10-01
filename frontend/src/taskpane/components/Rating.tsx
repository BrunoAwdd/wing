import * as React from "react";
import { useState } from "react";
import { makeStyles, tokens, Button, Text } from "@fluentui/react-components";
import { StarRegular, StarFilled } from "@fluentui/react-icons";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingTop: "10px",
  },
  starsContainer: {
    display: "flex",
    gap: "4px",
    cursor: "pointer",
  },
  thankYouText: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },
});

interface RatingProps {
  onRate: (rating: number) => void;
}

const Rating: React.FC<RatingProps> = ({ onRate }) => {
  const styles = useStyles();
  const [isRated, setIsRated] = useState(false);
  const [currentRating, setCurrentRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const handleRating = (rating: number) => {
    onRate(rating);
    setCurrentRating(rating);
    setIsRated(true);
  };

  if (isRated) {
    return (
      <div className={styles.root}>
        <Text className={styles.thankYouText}>Obrigado pelo seu feedback!</Text>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Text>Avalie a sugestão:</Text>
      <div className={styles.starsContainer} onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((starValue) => {
          const isFilled = starValue <= (hoverRating || currentRating);
          return (
            <div 
              key={starValue} 
              onMouseEnter={() => setHoverRating(starValue)} 
              onClick={() => handleRating(starValue)}
            >
              {isFilled ? 
                <StarFilled style={{ color: tokens.colorPaletteGoldBorderActive }} /> : 
                <StarRegular />
              }
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Rating;