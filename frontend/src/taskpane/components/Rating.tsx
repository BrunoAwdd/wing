import * as React from "react";
import { useState } from "react";
import { makeStyles, tokens, Button, Text } from "@fluentui/react-components";

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
  const [rated, setRated] = useState(false);

  const handleRating = (rating: number) => {
    onRate(rating);
    setRated(true);
  };

  if (rated) {
    return (
      <div className={styles.root}>
        <Text className={styles.thankYouText}>Obrigado pelo seu feedback!</Text>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Text>Avalie a sugestão:</Text>
      <div className={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Button
            key={star}
            appearance="subtle"
            size="small"
            onClick={() => handleRating(star)}
          >
            {star}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Rating;
